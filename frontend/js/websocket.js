// WebSocket connection handler
function initializeWebSocket(scanId) {
    // Close existing WebSocket if any
    if (websocket) {
        websocket.close();
    }

    // Create new WebSocket connection
    websocket = new WebSocket(`${WS_BASE_URL}/ws/${scanId}`);

    // Connection opened
    websocket.addEventListener('open', (event) => {
        console.log('WebSocket connection established');
    });

    // Listen for messages
    websocket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    });

    // Connection closed
    websocket.addEventListener('close', (event) => {
        console.log('WebSocket connection closed');
        websocket = null;
    });

    // Handle errors
    websocket.addEventListener('error', (event) => {
        console.error('WebSocket error:', event);
        showError('Lost connection to server. Please try refreshing the page.');
    });
}

function handleWebSocketMessage(data) {
    // Update progress and status
    updateProgress(data.progress, data.current_task);
    updateScanStatus(data.status);

    // Handle different scan states
    switch (data.status) {
        case 'running':
            handleRunningScan(data);
            break;
        case 'completed':
            handleCompletedScan(data);
            break;
        case 'failed':
            handleFailedScan(data);
            break;
    }
}

function handleRunningScan(data) {
    // Update progress indicators
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    // Animate progress bar
    progressBar.style.transition = 'width 0.5s ease-in-out';
    progressBar.style.width = `${data.progress}%`;
    
    // Update progress text with current task
    progressText.textContent = data.current_task;

    // Add visual feedback for current scanning activity
    addScanningActivity(data.current_task);
}

function handleCompletedScan(data) {
    // Set progress to 100%
    updateProgress(100, 'Scan completed successfully');
    
    // Display the results
    if (data.results) {
        displayResults(data.results);
    }

    // Show success notification
    showNotification('Scan completed successfully', 'success');
    
    // Close WebSocket connection
    if (websocket) {
        websocket.close();
    }
}

function handleFailedScan(data) {
    // Update UI to show failure
    updateScanStatus('failed');
    
    // Show error message
    showError(`Scan failed: ${data.error || 'Unknown error occurred'}`);
    
    // Close WebSocket connection
    if (websocket) {
        websocket.close();
    }
}

function addScanningActivity(task) {
    // Create activity element
    const activity = document.createElement('div');
    activity.className = 'flex items-center space-x-2 text-sm text-gray-600 animate-fade-in';
    
    // Add appropriate icon based on task
    const icon = getTaskIcon(task);
    
    activity.innerHTML = `
        <span class="text-blue-500">
            <i class="${icon}"></i>
        </span>
        <span>${task}</span>
    `;

    // Add to activity log
    const activityLog = document.getElementById('activityLog');
    if (activityLog) {
        // Keep only last 5 activities
        while (activityLog.children.length >= 5) {
            activityLog.removeChild(activityLog.firstChild);
        }
        
        activityLog.appendChild(activity);
        
        // Scroll to bottom
        activityLog.scrollTop = activityLog.scrollHeight;
    }
}

function getTaskIcon(task) {
    // Return appropriate Font Awesome icon based on task
    const taskLower = task.toLowerCase();
    if (taskLower.includes('url')) return 'fas fa-link';
    if (taskLower.includes('login')) return 'fas fa-sign-in-alt';
    if (taskLower.includes('admin')) return 'fas fa-user-shield';
    if (taskLower.includes('api')) return 'fas fa-key';
    if (taskLower.includes('wallet')) return 'fas fa-wallet';
    if (taskLower.includes('payment')) return 'fas fa-credit-card';
    return 'fas fa-search';
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    
    // Set appropriate classes based on type
    const baseClasses = 'fixed top-4 right-4 p-4 rounded shadow-lg flex items-center space-x-2';
    const typeClasses = {
        'success': 'bg-green-100 text-green-800 border-l-4 border-green-500',
        'error': 'bg-red-100 text-red-800 border-l-4 border-red-500',
        'info': 'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
    };
    
    notification.className = `${baseClasses} ${typeClasses[type]}`;
    
    // Set icon based on type
    const icons = {
        'success': 'fas fa-check-circle',
        'error': 'fas fa-exclamation-circle',
        'info': 'fas fa-info-circle'
    };
    
    notification.innerHTML = `
        <i class="${icons[type]}"></i>
        <span>${message}</span>
        <button class="ml-4 text-gray-500 hover:text-gray-700">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add click handler to close button
    notification.querySelector('button').addEventListener('click', () => {
        notification.remove();
    });

    // Add to document
    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Add custom animation for fade-in effect
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
        animation: fadeIn 0.3s ease-in-out;
    }
`;
document.head.appendChild(style);
