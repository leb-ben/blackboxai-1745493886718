// Constants
const API_BASE_URL = 'http://localhost:8001';
const WS_BASE_URL = 'ws://localhost:8001';

// Global state
let currentScanId = null;
let websocket = null;

// DOM Elements
const scanForm = document.getElementById('scanForm');
const progressSection = document.getElementById('progressSection');
const resultsSection = document.getElementById('resultsSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressPercentage = document.getElementById('progressPercentage');
const scanStatus = document.getElementById('scanStatus');
const exportButton = document.getElementById('exportButton');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    console.log('Form element:', document.getElementById('scanForm'));
    initializeEventListeners();
});

function initializeEventListeners() {
    console.log('Initializing event listeners');
    const form = document.getElementById('scanForm');
    if (form) {
        console.log('Form found, adding submit listener');
        form.addEventListener('submit', handleScanSubmit);
    } else {
        console.error('Form not found!');
    }
    exportButton.addEventListener('click', handleExportResults);
}

async function handleScanSubmit(event) {
    console.log('Form submission started');
    event.preventDefault();

    const baseUrl = document.getElementById('baseUrl').value.trim();
    console.log('Base URL:', baseUrl);

    const scanOptions = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);
    console.log('Selected scan options:', scanOptions);

    // Validate URL
    try {
        new URL(baseUrl);
        console.log('URL validation passed');
    } catch (e) {
        console.error('URL validation failed:', e);
        showError('Please enter a valid URL (e.g., https://example.com)');
        return;
    }

    try {
        // Ensure at least one option is selected
        const selectedOptions = scanOptions.length > 0 ? scanOptions : ["full"];
        
        const requestData = {
            base_url: baseUrl,
            scan_options: selectedOptions
        };
        
        // Debug logging
        console.log('Request data:', requestData);
        console.log('Request JSON:', JSON.stringify(requestData, null, 2));

        const response = await fetch(`${API_BASE_URL}/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        currentScanId = data.scan_id;

        // Show progress section and hide results
        showProgress();
        hideResults();

        // Initialize WebSocket connection
        initializeWebSocket(currentScanId);

    } catch (error) {
        console.error('Error details:', error);
        showError(`Failed to start scan: ${error.message}`);
    }
}

function showProgress() {
    progressSection.classList.remove('hidden');
    updateProgress(0, 'Initializing scan...');
    updateScanStatus('initializing');
}

function hideResults() {
    resultsSection.classList.add('hidden');
}

function showResults() {
    resultsSection.classList.remove('hidden');
}

function updateProgress(percent, message) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = message;
    progressPercentage.textContent = `${percent}%`;
}

function updateScanStatus(status) {
    const statusMap = {
        'initializing': ['bg-yellow-100 text-yellow-800', 'Initializing'],
        'running': ['bg-blue-100 text-blue-800', 'Running'],
        'completed': ['bg-green-100 text-green-800', 'Completed'],
        'failed': ['bg-red-100 text-red-800', 'Failed']
    };

    const [className, text] = statusMap[status] || ['bg-gray-100 text-gray-800', 'Unknown'];
    
    scanStatus.className = `px-2 py-1 text-sm rounded-full ${className}`;
    scanStatus.textContent = text;
}

function displayResults(results) {
    showResults();

    // Display Hidden URLs
    const hiddenUrlsContainer = document.getElementById('hiddenUrls');
    hiddenUrlsContainer.innerHTML = results.hidden_urls.map(url => `
        <div class="p-2 bg-gray-50 rounded">
            <a href="${url}" target="_blank" class="text-blue-600 hover:text-blue-800">${url}</a>
        </div>
    `).join('') || '<p class="text-gray-500">No hidden URLs found</p>';

    // Display Login Forms
    const loginFormsContainer = document.getElementById('loginForms');
    loginFormsContainer.innerHTML = results.login_forms.map(form => `
        <div class="p-4 bg-gray-50 rounded">
            <div class="font-medium">URL: ${form.url}</div>
            <div class="text-sm text-gray-600">Method: ${form.method.toUpperCase()}</div>
            <div class="mt-2">
                <div class="font-medium">Fields:</div>
                <ul class="list-disc list-inside">
                    ${Object.entries(form.fields).map(([name, type]) => `
                        <li class="text-sm">${name}: ${type}</li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `).join('') || '<p class="text-gray-500">No login forms found</p>';

    // Display Admin Panels
    const adminPanelsContainer = document.getElementById('adminPanels');
    adminPanelsContainer.innerHTML = results.admin_panels.map(panel => `
        <div class="p-4 bg-gray-50 rounded">
            <div class="font-medium">URL: ${panel.url}</div>
            <div class="text-sm text-gray-600">
                Type: ${panel.type} (${Math.round(panel.confidence * 100)}% confidence)
            </div>
        </div>
    `).join('') || '<p class="text-gray-500">No admin panels found</p>';

    // Display API Keys
    const apiKeysContainer = document.getElementById('apiKeys');
    apiKeysContainer.innerHTML = results.api_keys.map(key => `
        <div class="p-4 bg-gray-50 rounded">
            <div class="font-medium">Type: ${key.type}</div>
            <div class="text-sm font-mono bg-gray-100 p-2 mt-2 rounded">${key.key}</div>
            <div class="text-sm text-gray-600 mt-2">Location: ${key.location}</div>
            <div class="mt-2">
                <div class="font-medium">Example Usage:</div>
                <pre class="text-sm bg-gray-100 p-2 mt-1 rounded overflow-x-auto">${key.example_usage}</pre>
            </div>
        </div>
    `).join('') || '<p class="text-gray-500">No API keys found</p>';

    // Display Wallet Keys
    const walletKeysContainer = document.getElementById('walletKeys');
    walletKeysContainer.innerHTML = results.wallet_keys.map(key => `
        <div class="p-4 bg-gray-50 rounded">
            <div class="font-medium">Type: ${key.type}</div>
            <div class="text-sm font-mono bg-gray-100 p-2 mt-2 rounded">${key.key}</div>
            <div class="text-sm text-gray-600 mt-2">
                Location: ${key.location}<br>
                Currency: ${key.currency || 'Unknown'}
            </div>
        </div>
    `).join('') || '<p class="text-gray-500">No wallet keys found</p>';

    // Display Payment Information
    const paymentInfoContainer = document.getElementById('paymentInfo');
    paymentInfoContainer.innerHTML = results.payment_info.map(info => `
        <div class="p-4 bg-gray-50 rounded">
            <div class="font-medium">Gateway: ${info.gateway}</div>
            <div class="text-sm text-gray-600">Type: ${info.type}</div>
            <div class="text-sm text-gray-600">Location: ${info.location}</div>
            ${Object.keys(info.fields).length > 0 ? `
                <div class="mt-2">
                    <div class="font-medium">Fields:</div>
                    <ul class="list-disc list-inside">
                        ${Object.entries(info.fields).map(([name, type]) => `
                            <li class="text-sm">${name}: ${type}</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `).join('') || '<p class="text-gray-500">No payment information found</p>';

    // Initialize tree visualization
    initializeTreeVisualization(results.site_structure);
}

function handleExportResults() {
    if (!currentScanId) {
        showError('No scan results to export');
        return;
    }

    fetch(`${API_BASE_URL}/results/${currentScanId}`)
        .then(response => response.json())
        .then(results => {
            const dataStr = JSON.stringify(results, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `scan-results-${currentScanId}.json`;

            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        })
        .catch(error => showError(`Failed to export results: ${error.message}`));
}

function showError(message) {
    // Create error notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg';
    notification.innerHTML = `
        <div class="flex items-center">
            <div class="py-1"><i class="fas fa-exclamation-circle"></i></div>
            <div class="ml-3">
                <p class="text-sm">${message}</p>
            </div>
            <div class="ml-4">
                <button class="text-red-700 hover:text-red-900">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
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
