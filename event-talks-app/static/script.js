// Application State
let releaseNotes = [];
let selectedNoteIndex = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const spinner = document.getElementById('spinner');
const totalNotesCount = document.getElementById('totalNotesCount');
const lastUpdatedTime = document.getElementById('lastUpdatedTime');
const selectionStatus = document.getElementById('selectionStatus');
const tweetSelectedBtn = document.getElementById('tweetSelectedBtn');
const feedContainer = document.getElementById('feedContainer');
const loader = document.getElementById('loader');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');

// Modal Elements
const tweetModal = document.getElementById('tweetModal');
const tweetTextArea = document.getElementById('tweetTextArea');
const charCount = document.getElementById('charCount');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelTweetBtn = document.getElementById('cancelTweetBtn');
const postTweetBtn = document.getElementById('postTweetBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    
    // Event Listeners
    refreshBtn.addEventListener('click', fetchReleaseNotes);
    retryBtn.addEventListener('click', fetchReleaseNotes);
    searchInput.addEventListener('input', filterNotes);
    tweetSelectedBtn.addEventListener('click', openTweetComposer);
    
    // Modal Listeners
    closeModalBtn.addEventListener('click', closeComposer);
    cancelTweetBtn.addEventListener('click', closeComposer);
    tweetTextArea.addEventListener('input', updateCharCount);
    postTweetBtn.addEventListener('click', publishTweet);
    
    // Close modal on background click
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeComposer();
        }
    });
});

// Fetch data from Flask API
async function fetchReleaseNotes() {
    showLoader();
    try {
        const response = await fetch('/api/release-notes');
        const result = await response.json();
        
        if (result.success && result.data) {
            releaseNotes = result.data;
            renderNotes(releaseNotes);
            
            // Update stats
            totalNotesCount.textContent = releaseNotes.length;
            const now = new Date();
            lastUpdatedTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            // Clear selection
            deselectAll();
            showFeed();
        } else {
            showError(result.error || 'Server returned an error');
        }
    } catch (err) {
        showError('Network error connecting to Flask backend. Please make sure the server is running.');
        console.error(err);
    } finally {
        hideLoader();
    }
}

// Display notes in container
function renderNotes(notesToRender) {
    feedContainer.innerHTML = '';
    
    if (notesToRender.length === 0) {
        feedContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
                <p>No matching release notes found.</p>
            </div>
        `;
        return;
    }
    
    notesToRender.forEach((note, index) => {
        // Find original index in full list
        const originalIndex = releaseNotes.findIndex(n => n.title === note.title && n.date === note.date);
        const isSelected = selectedNoteIndex === originalIndex;
        
        const card = document.createElement('div');
        card.className = `feed-card ${isSelected ? 'selected' : ''}`;
        card.dataset.index = originalIndex;
        
        // Parse date for display
        let displayDate = note.date;
        try {
            const dateObj = new Date(note.date);
            if (!isNaN(dateObj)) {
                displayDate = dateObj.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
            }
        } catch(e) {}
        
        card.innerHTML = `
            <div class="card-selector">
                <div class="custom-checkbox">
                    <i class="fa-solid fa-check"></i>
                </div>
            </div>
            <div class="card-content">
                <div class="card-header">
                    <h3 class="card-title">${note.title}</h3>
                    <span class="card-date"><i class="fa-regular fa-calendar"></i> ${displayDate}</span>
                </div>
                <div class="card-description">${note.content}</div>
                <div class="card-footer">
                    <div class="card-links">
                        ${note.link ? `<a href="${note.link}" target="_blank" rel="noopener" class="card-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> View Source</a>` : ''}
                    </div>
                    <button class="btn-card-tweet" onclick="triggerDirectTweet(event, ${originalIndex})">
                        <i class="fa-brands fa-x-twitter"></i> Tweet Update
                    </button>
                </div>
            </div>
        `;
        
        // Setup card selection click
        card.addEventListener('click', (e) => {
            // Avoid selecting card if link or individual tweet button is clicked
            if (e.target.tagName === 'A' || e.target.closest('a') || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            toggleSelectNote(originalIndex);
        });
        
        feedContainer.appendChild(card);
    });
}

// Select/Deselect single note
function toggleSelectNote(index) {
    if (selectedNoteIndex === index) {
        deselectAll();
    } else {
        selectedNoteIndex = index;
        
        // Update selection UI indicator
        const selectedNote = releaseNotes[index];
        selectionStatus.textContent = `Selected: "${truncateText(selectedNote.title, 30)}"`;
        selectionStatus.classList.add('active');
        tweetSelectedBtn.removeAttribute('disabled');
        
        // Redraw cards to update classes
        const searchVal = searchInput.value;
        if (searchVal) {
            filterNotes();
        } else {
            renderNotes(releaseNotes);
        }
    }
}

function deselectAll() {
    selectedNoteIndex = null;
    selectionStatus.textContent = "No update selected";
    selectionStatus.classList.remove('active');
    tweetSelectedBtn.setAttribute('disabled', 'true');
    renderNotes(releaseNotes);
}

// Search and Filter logic
function filterNotes() {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
        renderNotes(releaseNotes);
        return;
    }
    
    const filtered = releaseNotes.filter(note => {
        return note.title.toLowerCase().includes(query) || 
               note.content.toLowerCase().includes(query);
    });
    
    renderNotes(filtered);
}

// UI States
function showLoader() {
    loader.classList.remove('hidden');
    feedContainer.classList.add('hidden');
    errorState.classList.add('hidden');
    spinner.classList.add('spinning');
    refreshBtn.setAttribute('disabled', 'true');
}

function hideLoader() {
    loader.classList.add('hidden');
    spinner.classList.remove('spinning');
    refreshBtn.removeAttribute('disabled');
}

function showFeed() {
    feedContainer.classList.remove('hidden');
    errorState.classList.add('hidden');
}

function showError(msg) {
    errorMessage.textContent = msg;
    errorState.classList.remove('hidden');
    feedContainer.classList.add('hidden');
}

// Truncate Text helper
function truncateText(text, maxLen) {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + '...';
}

// HTML Strip helper for clean tweet formatting
function stripHtml(html) {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

// Compose Tweet Template
function generateTweetText(note) {
    const cleanTitle = note.title.trim();
    const cleanContent = stripHtml(note.content).trim().replace(/\s+/g, ' ');
    const hashtag = " #BigQuery #GoogleCloud";
    const link = note.link ? ` ${note.link}` : '';
    
    // Calculate space left for the body summary
    // Twitter max is 280
    // Reserve space for: Title + "BigQuery Update: " + "..." + Link + Hashtag + format spacing
    const prefix = "BigQuery Update: ";
    const fixedLength = prefix.length + cleanTitle.length + link.length + hashtag.length + 6; // extra spacings
    const maxBodyLength = 280 - fixedLength;
    
    let bodyText = "";
    if (maxBodyLength > 10) {
        bodyText = `\n\n${truncateText(cleanContent, maxBodyLength)}`;
    }
    
    return `${prefix}${cleanTitle}${bodyText}${link}${hashtag}`;
}

// Trigger tweet directly from card button
function triggerDirectTweet(event, index) {
    event.stopPropagation(); // Stop card click selection
    selectedNoteIndex = index;
    openTweetComposer();
}

// Tweet Composer Modal Management
function openTweetComposer() {
    if (selectedNoteIndex === null) return;
    
    const note = releaseNotes[selectedNoteIndex];
    const initialText = generateTweetText(note);
    
    tweetTextArea.value = initialText;
    updateCharCount();
    
    tweetModal.classList.remove('hidden');
    tweetTextArea.focus();
}

function closeComposer() {
    tweetModal.classList.add('hidden');
}

function updateCharCount() {
    const length = tweetTextArea.value.length;
    charCount.textContent = `${length} / 280`;
    
    if (length > 280) {
        charCount.style.color = '#EF4444';
        postTweetBtn.setAttribute('disabled', 'true');
    } else {
        charCount.style.color = 'var(--text-muted)';
        postTweetBtn.removeAttribute('disabled');
    }
}

function publishTweet() {
    const text = tweetTextArea.value;
    if (text.length > 280) return;
    
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    
    closeComposer();
}
