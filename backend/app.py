from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Optional
import logging
import asyncio
from datetime import datetime
import json

from scraper import WebScraper
from models import (
    ScanRequest,
    ScanResult,
    ScanStatus,
    ScanType
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Advanced Web Scraper API",
    description="API for authorized penetration testing web scraper",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://0.0.0.0:8000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Add logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response

# Store active scans and their statuses
active_scans: Dict[str, ScanStatus] = {}
# Store WebSocket connections for each scan
websocket_connections: Dict[str, List[WebSocket]] = {}

async def update_scan_status(scan_id: str, **updates):
    """Update scan status and notify all connected WebSocket clients"""
    if scan_id in active_scans:
        for key, value in updates.items():
            setattr(active_scans[scan_id], key, value)
        
        if scan_id in websocket_connections:
            status_data = active_scans[scan_id].dict()
            for websocket in websocket_connections[scan_id]:
                try:
                    await websocket.send_json(status_data)
                except Exception as e:
                    logger.error(f"Error sending WebSocket update: {str(e)}")

async def run_scan(scan_id: str, scraper: WebScraper, scan_options: List[ScanType]):
    """Execute the scan in the background"""
    try:
        await update_scan_status(
            scan_id,
            status="running",
            progress=0,
            current_task="Initializing scan"
        )

        # Initialize progress tracking
        total_steps = len(scan_options)
        current_step = 0

        # Run the scan
        results = await scraper.run_scan(scan_options)
        
        # Update final status
        await update_scan_status(
            scan_id,
            status="completed",
            progress=100,
            current_task="Scan completed",
            results=results,
            end_time=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Error during scan {scan_id}: {str(e)}")
        await update_scan_status(
            scan_id,
            status="failed",
            error=str(e),
            end_time=datetime.now().isoformat()
        )

@app.post("/scan", response_model=dict)
async def start_scan(scan_request: ScanRequest, background_tasks: BackgroundTasks):
    """Start a new scan with the provided parameters"""
    try:
        # Generate unique scan ID
        scan_id = datetime.now().strftime("%Y%m%d%H%M%S")
        
        # Initialize scraper
        scraper = WebScraper(str(scan_request.base_url))
        
        # Initialize scan status
        active_scans[scan_id] = ScanStatus(
            id=scan_id,
            status="initializing",
            progress=0,
            current_task="Starting scan",
            results=None
        )
        
        # Add scan task to background tasks
        background_tasks.add_task(
            run_scan,
            scan_id,
            scraper,
            scan_request.scan_options
        )
        
        return {
            "scan_id": scan_id,
            "message": "Scan started successfully",
            "status": "initializing"
        }
    
    except Exception as e:
        logger.error(f"Error starting scan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{scan_id}")
async def get_scan_status(scan_id: str):
    """Get the current status of a scan"""
    if scan_id not in active_scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    return active_scans[scan_id]

@app.websocket("/ws/{scan_id}")
async def websocket_endpoint(websocket: WebSocket, scan_id: str):
    """WebSocket endpoint for real-time scan updates"""
    await websocket.accept()
    
    # Add connection to the list
    if scan_id not in websocket_connections:
        websocket_connections[scan_id] = []
    websocket_connections[scan_id].append(websocket)
    
    try:
        while True:
            if scan_id in active_scans:
                status = active_scans[scan_id]
                await websocket.send_json(status.dict())
                if status.status in ["completed", "failed"]:
                    break
            await asyncio.sleep(1)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        # Remove connection from the list
        if scan_id in websocket_connections:
            websocket_connections[scan_id].remove(websocket)
            if not websocket_connections[scan_id]:
                del websocket_connections[scan_id]
        await websocket.close()

@app.get("/results/{scan_id}")
async def get_scan_results(scan_id: str):
    """Get the final results of a completed scan"""
    if scan_id not in active_scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    status = active_scans[scan_id]
    if status.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Scan not completed. Current status: {status.status}"
        )
    
    return status.results

@app.delete("/scan/{scan_id}")
async def delete_scan(scan_id: str):
    """Delete a completed scan and its results"""
    if scan_id not in active_scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    status = active_scans[scan_id]
    if status.status not in ["completed", "failed"]:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete active scan"
        )
    
    del active_scans[scan_id]
    return {"message": "Scan deleted successfully"}

@app.get("/scans")
async def list_scans():
    """List all scans and their current status"""
    return {
        scan_id: {
            "status": scan.status,
            "start_time": scan.start_time,
            "end_time": scan.end_time,
            "progress": scan.progress
        }
        for scan_id, scan in active_scans.items()
    }

import os

if __name__ == "__main__":
    import uvicorn
    # For local testing, default host and port
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8001))

    # Uncomment below to use environment variables for deployment
    # host = os.getenv("HOST", "0.0.0.0")
    # port = int(os.getenv("PORT", 8000))

    uvicorn.run(app, host=host, port=port)
