from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime

class ScanType(str, Enum):
    FULL = "full"
    URLS = "urls"
    LOGIN = "login"
    ADMIN = "admin"
    API_KEYS = "api_keys"
    WALLET = "wallet"
    PAYMENT = "payment"

class ScanRequest(BaseModel):
    base_url: HttpUrl
    scan_options: List[ScanType] = [ScanType.FULL]

class LoginForm(BaseModel):
    url: str
    form_action: str
    fields: Dict[str, str]
    method: str
    additional_info: Optional[Dict[str, Any]]

class AdminPanel(BaseModel):
    url: str
    type: str
    confidence: float
    detection_method: str
    additional_info: Optional[Dict[str, Any]]

class APIKey(BaseModel):
    key: str
    type: str
    location: str
    example_usage: str
    confidence: float
    context: Optional[str]

class WalletKey(BaseModel):
    key: str
    type: str
    location: str
    currency: Optional[str]
    confidence: float

class PaymentInfo(BaseModel):
    type: str
    gateway: str
    location: str
    fields: Dict[str, str]
    security_level: Optional[str]

class TreeNode(BaseModel):
    url: str
    title: Optional[str]
    children: List['TreeNode'] = []
    type: str = "page"
    metadata: Optional[Dict[str, Any]]

class ScanResult(BaseModel):
    site_structure: TreeNode
    hidden_urls: List[str] = []
    login_forms: List[LoginForm] = []
    admin_panels: List[AdminPanel] = []
    api_keys: List[APIKey] = []
    wallet_keys: List[WalletKey] = []
    payment_info: List[PaymentInfo] = []
    scan_metadata: Dict[str, Any]

class ScanStatus(BaseModel):
    id: str
    status: str  # "initializing", "running", "completed", "failed"
    progress: float  # 0 to 100
    current_task: str
    start_time: str = datetime.now().isoformat()
    end_time: Optional[str] = None
    results: Optional[ScanResult]
    error: Optional[str]

    class Config:
        arbitrary_types_allowed = True

    def update_end_time(self):
        self.end_time = datetime.now().isoformat()

TreeNode.update_forward_refs()
