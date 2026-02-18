let database = null;
let schemaMap = {};
let allBlocks = []; // Store all blocks for filtering
let currentActiveBlockElement = null; // Track the currently active block element

// Debounce function to limit how often a function is called
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

async function init() {
    try {
        const response = await fetch('MinecraftBlocksBase.json');
        database = await response.json();
        allBlocks = database.data; // Store all blocks
        
        database.schema.forEach(field => {
            schemaMap[field.id] = field;
        });

        renderBlockList(allBlocks);
        setupSearch();
        setupBugReportModal(); // Setup bug report modal

        if (allBlocks.length > 0) {
            // Automatically select and show details for the first block
            const firstBlock = allBlocks[0];
            showBlockDetails(firstBlock);
            // Mark the first item as active
            setTimeout(() => {
                const firstItem = document.querySelector('.block-item');
                if (firstItem) {
                    firstItem.classList.add('active');
                    currentActiveBlockElement = firstItem;
                }
            }, 0);
        }
    } catch (error) {
        console.error('Error loading database:', error);
        document.getElementById('rightPanel').innerHTML = '<h1>Error loading database</h1>';
    }
}

function renderBlockList(blocks) {
    const listElement = document.getElementById('blockList');
    listElement.innerHTML = '';

    const blockCountElement = document.getElementById('blockCount');
    blockCountElement.textContent = `${blocks.length} / ${allBlocks.length} blocks found`;

    if (blocks.length === 0) {
        listElement.innerHTML = '<div style="padding: 10px; color: #888;">No blocks found</div>';
        return;
    }

    const nameId = database.schema.find(f => f.name === 'Name')?.id;
    const textureId = database.schema.find(f => f.name === 'Texture')?.id;

    blocks.forEach((block) => {
        const name = block[nameId] || 'Unknown Block';
        const texture = block[textureId] || '';

        const item = document.createElement('div');
        item.className = 'block-item';
        item.dataset.blockId = block[database.schema.find(f => f.name === 'ID')?.id]; // Store ID for active state
        item.innerHTML = `
            ${texture ? `<img src="${texture}" alt="${name}">` : '<div style="width:32px;height:32px;background:#333;border-radius:4px;"></div>'}
            <span>${name}</span>
        `;
        item.onclick = () => {
            if (currentActiveBlockElement) {
                currentActiveBlockElement.classList.remove('active');
            }
            item.classList.add('active');
            currentActiveBlockElement = item;
            showBlockDetails(block);
        };
        listElement.appendChild(item);
    });
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const nameId = database.schema.find(f => f.name === 'Name')?.id;

    const performSearch = (query) => {
        const filteredBlocks = allBlocks.filter(block => {
            const name = (block[nameId] || '').toLowerCase();
            return name.includes(query);
        });
        renderBlockList(filteredBlocks);
    };

    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.toLowerCase();
        performSearch(query);
    }, 300)); // Debounce with 300ms
}

function showBlockDetails(block) {
    const rightPanel = document.getElementById('rightPanel');
    
    const nameId = database.schema.find(f => f.name === 'Name')?.id;
    const textureId = database.schema.find(f => f.name === 'Texture')?.id;
    const namespaceId = database.schema.find(f => f.name === 'Namespace')?.id;
    const blockIdField = database.schema.find(f => f.name === 'ID')?.id;

    const name = block[nameId] || 'Unknown Block';
    const texture = block[textureId] || '';
    const namespace = block[namespaceId] || 'minecraft';
    const blockIdValue = block[blockIdField] || '';


    let detailsHtml = `
        <div class="block-details">
            <div class="block-header">
                ${texture ? `<img src="${texture}" alt="${name}">` : ''}
                <div>
                    <h1>${name}</h1>
                    <div class="block-id-display">${namespace}:${blockIdValue}</div>
                </div>
                <button id="reportBugButton" class="report-bug-button">Report Bug</button>
            </div>
            <div class="block-info-grid">
    `;

    // Iterate through schema to show all fields directly
    database.schema.forEach(field => {
        // Skip Name and Texture as they are in the header
        // Skip Namespace and ID as they are combined in block-id-display
        if (field.id === nameId || field.id === textureId || field.id === namespaceId || field.id === blockIdField) return;

        const value = block[field.id];
        if (value !== undefined && value !== null && value !== '') {
            detailsHtml += `
                <div class="info-card">
                    <div class="info-label">${field.name}</div>
                    <div class="info-value">${formatValue(value, field)}</div>
                </div>
            `;
        }
    });

    detailsHtml += `
            </div>
        </div>
    `;

    rightPanel.innerHTML = detailsHtml;

    // Attach event listener for the bug report button after it's rendered
    document.getElementById('reportBugButton').addEventListener('click', () => {
        openBugReportModal(name); // Pass only name
    });
}

function formatValue(value, field) {
    if (field.type === 'checkbox') {
        return value ? '<span style="color: #4caf50; font-weight: bold;">Yes</span>' : '<span style="color: #f44336; font-weight: bold;">No</span>';
    }
    if (field.type === 'image') {
        // If it's the main texture, it's handled in the header. Other images might be rendered here.
        return `<img src="${value}" style="max-width: 100%; height: auto; image-rendering: pixelated; border: 1px solid #444; border-radius: 4px; padding: 5px; background-color: #111;">`;
    }
    if (field.type === 'select' && field.isMulti) {
        const tags = String(value).split(',').map(t => t.trim()).filter(t => t !== '');
        if (tags.length === 0) return 'None';
        return tags.map(tag => `<span class="tag-pill">${tag}</span>`).join('');
    }
    if (field.name === 'Hardness' || field.name === 'Resistance' || field.name === 'Light Level' || field.name === 'Stack Size') {
        return `<span style="font-weight: bold;">${value}</span>`;
    }
    // Default formatting
    return value;
}

// Bug Report Modal Functions
function setupBugReportModal() {
    const modalHtml = `
        <div id="bugReportModal" class="modal">
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h2>Report a Bug</h2>
                <form name="bug-report" method="POST" data-netlify="true" netlify-honeypot="bot-field">
                    <input type="hidden" name="form-name" value="bug-report" />
                    <input type="hidden" id="bug-block-id-hidden" name="block-id">
                    <p class="hidden">
                        <label>Don’t fill this out if you’re human: <input name="bot-field" /></label>
                    </p>
                    <label for="block-name-bug">Block Name:</label>
                    <input type="text" id="block-name-bug" name="block-name" readonly>

                    <label for="bug-description">Description of Bug:</label>
                    <textarea id="bug-description" name="description" required></textarea>

                    <label for="bug-additional-details">Additional Details (Steps to Reproduce, Expected/Actual Behavior - optional):</label>
                    <textarea id="bug-additional-details" name="additional-details"></textarea>

                    <label for="user-nickname-bug">Your Nickname (optional):</label>
                    <input type="text" id="user-nickname-bug" name="nickname">

                    <button type="submit" class="submit-button">Send Report</button>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('bugReportModal');
    const closeButton = modal.querySelector('.close-button');
    const form = modal.querySelector('form');

    closeButton.onclick = () => {
        modal.classList.remove('show');
    };
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.classList.remove('show');
        }
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        // Here, the form will be submitted by Netlify Forms.
        // We just handle the UI feedback.
        modal.classList.remove('show');
        showToastNotification('Bug report submitted successfully! Thank you.');
        form.reset(); // Clear form fields
    });
}

function openBugReportModal(blockName) {
    const modal = document.getElementById('bugReportModal');
    const blockNameInput = modal.querySelector('#block-name-bug');
    const blockIdHiddenInput = modal.querySelector('#bug-block-id-hidden');

    // Get the currently displayed block's ID to include it in the hidden field
    const currentBlockElement = document.querySelector('.block-item.active');
    const blockId = currentBlockElement ? currentBlockElement.dataset.blockId : 'N/A';

    blockNameInput.value = blockName;
    blockIdHiddenInput.value = blockId;
    
    modal.classList.add('show');
}

function showToastNotification(message) {
    const toast = document.getElementById('toastNotification');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000); // Hide after 3 seconds
}

init();