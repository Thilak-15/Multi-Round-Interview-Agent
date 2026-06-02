// Python Flask version - Frontend JavaScript
// This communicates with Python Flask backend via API calls

// Application State
const state = {
    currentUser: null,
    currentRound: null,
    currentQuestion: 0,
    score: 0,
    answers: [],
    roundScores: { round1: null, round2: null, round3: null },
    currentQuestionData: null,
    timer: null,
    timeRemaining: 0,
    allQuestions: [], // Store all questions for review
    selectedAnswers: {}, // Store selected answers {questionNumber: selectedOption}
    isReviewMode: false,
    userType: 'demo' // Default user type
};

// DOM Elements
const pages = {
    login: document.getElementById('loginPage'),
    dashboard: document.getElementById('dashboardPage'),
    chat: document.getElementById('chatPage')
};

const elements = {
    loginForm: document.getElementById('loginForm'),
    logoutBtn: document.getElementById('logoutBtn'),
    startRound1: document.getElementById('startRound1'),
    startRound2: document.getElementById('startRound2'),
    startRound3: document.getElementById('startRound3'),
    chatMessages: document.getElementById('chatMessages'),
    mcqOptions: document.getElementById('mcqOptions'),
    codingArea: document.getElementById('codingArea'),
    codeEditor: document.getElementById('codeEditor'),
    submitCode: document.getElementById('submitCode'),
    backToDashboard: document.getElementById('backToDashboard'),
    chatTitle: document.getElementById('chatTitle'),
    roundInfo: document.getElementById('roundInfo'),
    questionCounter: document.getElementById('questionCounter'),
    timerDisplay: document.getElementById('timerDisplay'),
    adminControls: document.getElementById('adminControls'), // Admin controls section
    viewResultsBtn: document.getElementById('viewResultsBtn') // Results button
};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    showPage('login');
});

function initializeEventListeners() {
    // Login form
    elements.loginForm.addEventListener('submit', handleLogin);
    
    // Logout
    elements.logoutBtn.addEventListener('click', handleLogout);
    
    // Round buttons
    elements.startRound1.addEventListener('click', () => startRound(1));
    elements.startRound2.addEventListener('click', () => startRound(2));
    elements.startRound3.addEventListener('click', () => startRound(3));
    
    // Code submission
    elements.submitCode.addEventListener('click', handleCodeSubmission);
    
    // View results button
    if (elements.viewResultsBtn) {
        elements.viewResultsBtn.addEventListener('click', async () => {
            console.log('View Final Results clicked');
            
            // Check if user is still logged in
            if (!state.currentUser) {
                alert('Session expired. Please log in again.');
                showPage('login');
                return;
            }
            
            // Check if all rounds are completed
            const allCompleted = state.roundScores.round1 !== null && 
                               state.roundScores.round2 !== null && 
                               state.roundScores.round3 !== null;
            
            if (!allCompleted) {
                alert('All rounds must be completed to view final results.');
                return;
            }
            
            // Verify session with backend before redirecting
            try {
                const response = await fetch('/api/get_dashboard_status');
                const data = await response.json();
                
                if (!data.success) {
                    alert('Session expired. Please log in again.');
                    showPage('login');
                    return;
                }
                
                console.log('Redirecting to completion page');
                window.location.href = '/completion';
            } catch (error) {
                console.error('Error checking session:', error);
                alert('Error verifying session. Please try again.');
            }
        });
    }
    
    // Back to dashboard
    elements.backToDashboard.addEventListener('click', async () => {
        stopTimer();
        
        // Check if all rounds are completed
        const allCompleted = state.roundScores.round1 !== null && 
                           state.roundScores.round2 !== null && 
                           state.roundScores.round3 !== null;
        
        if (allCompleted) {
            // Redirect to completion page
            window.location.href = '/completion';
        } else {
            showPage('dashboard');
            await loadDashboardStatus();
        }
    });
}

function showPage(pageId) {
    Object.values(pages).forEach(page => page.classList.remove('active'));
    pages[pageId].classList.add('active');
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reset all frontend state
            state.currentUser = username;
            state.currentRound = null;
            state.currentQuestion = 0;
            state.score = 0;
            state.answers = [];
            state.roundScores = { round1: null, round2: null, round3: null };
            state.currentQuestionData = null;
            state.selectedAnswers = {};
            state.allQuestions = [];
            state.userType = data.user_type || 'demo'; // Store user type
            
            // Show admin controls if admin user
            const adminControls = document.getElementById('adminControls');
            if (adminControls) {
                adminControls.style.display = state.userType === 'admin' ? 'block' : 'none';
            }
            
            showPage('dashboard');
            await loadDashboardStatus();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        
        // Reset all frontend state
        state.currentUser = null;
        state.currentRound = null;
        state.currentQuestion = 0;
        state.score = 0;
        state.answers = [];
        state.roundScores = { round1: null, round2: null, round3: null };
        state.currentQuestionData = null;
        state.selectedAnswers = {};
        state.allQuestions = [];
        state.isReviewMode = false;
        state.userType = 'demo'; // Reset user type
        
        showPage('login');
        document.getElementById('loginForm').reset();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function loadDashboardStatus() {
    try {
        const response = await fetch('/api/get_dashboard_status');
        const data = await response.json();
        
        if (data.success) {
            state.roundScores = data.round_scores;
            updateDashboard();
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function updateDashboard() {
    const { roundScores } = state;
    
    // Update round cards
    updateRoundCard(1, roundScores.round1);
    updateRoundCard(2, roundScores.round2);
    updateRoundCard(3, roundScores.round3);
    
    // Check if all rounds are completed
    const allCompleted = roundScores.round1 !== null && 
                        roundScores.round2 !== null && 
                        roundScores.round3 !== null;
    
    // Show/hide completion section
    const completionSection = document.getElementById('completionSection');
    if (completionSection) {
        completionSection.style.display = allCompleted ? 'block' : 'none';
    }
}

function updateRoundCard(round, score) {
    const card = document.getElementById(`round${round}Card`);
    const status = document.getElementById(`round${round}Status`);
    const button = document.getElementById(`startRound${round}`);
    
    // Reset classes
    card.classList.remove('locked', 'completed', 'failed');
    
    if (score === null) {
        // Not attempted
        if (round === 1 || (round === 2 && state.roundScores.round1 >= 7) || (round === 3 && state.roundScores.round2 >= 7)) {
            status.textContent = 'Ready to start';
            button.disabled = false;
            button.classList.remove('disabled');
            button.textContent = `Start Round ${round}`;
        } else {
            card.classList.add('locked');
            status.textContent = `🔒 Complete Round ${round - 1} first`;
            button.disabled = true;
            button.classList.add('disabled');
        }
    } else if (score >= 7 || (round === 3 && score > 0)) {
        // Passed
        card.classList.add('completed');
        status.textContent = round === 3 ? '✅ Completed' : `✅ Passed (${score}/10)`;
        button.textContent = 'Retake';
        button.disabled = false;
        button.classList.remove('disabled');
    } else {
        // Failed
        card.classList.add('failed');
        status.textContent = `❌ Failed (${score}/10)`;
        button.textContent = 'Retry';
        button.disabled = false;
        button.classList.remove('disabled');
    }
}

async function startRound(roundNumber) {
    state.currentRound = roundNumber;
    state.currentQuestion = 0;
    state.score = 0;
    state.answers = [];
    state.allQuestions = []; // Reset questions array
    state.selectedAnswers = {}; // Reset selected answers
    state.isReviewMode = false;
    
    try {
        // Start round on backend
        const response = await fetch('/api/start_round', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ round_number: roundNumber })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showPage('chat');
            setupChatInterface(roundNumber, data.round_info);
            
            // Clear previous messages
            elements.chatMessages.innerHTML = '';
            
            // Show welcome message
            await addAIMessage(data.welcome_message);
            
            // Generate first question
            await generateQuestion(roundNumber, 1);
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error starting round:', error);
        alert('Failed to start round. Please try again.');
    }
}

function setupChatInterface(roundNumber, roundInfo) {
    const titles = {
        1: 'Round 1: Screening (Aptitude & Reasoning)',
        2: 'Round 2: Technical (Python & AI/ML)',
        3: 'Round 3: Coding Challenge'
    };
    
    const info = {
        1: 'Aptitude & Reasoning',
        2: 'Python & AI/ML',
        3: 'Programming Problems'
    };
    
    elements.chatTitle.textContent = titles[roundNumber];
    elements.roundInfo.textContent = info[roundNumber];
    elements.questionCounter.textContent = roundNumber === 3 ? '2 Problems' : '10 Questions';
    
    // Hide/show appropriate input methods
    elements.mcqOptions.style.display = roundNumber === 3 ? 'none' : 'block';
    elements.codingArea.style.display = roundNumber === 3 ? 'block' : 'none';
    
    // Start timer for MCQ rounds
    if (roundInfo.time_limit) {
        startTimer(roundInfo.time_limit);
    } else {
        // Hide timer for coding round
        if (elements.timerDisplay) {
            elements.timerDisplay.style.display = 'none';
        }
    }
}

function startTimer(seconds) {
    state.timeRemaining = seconds;
    
    // Clear any existing timer
    if (state.timer) {
        clearInterval(state.timer);
    }
    
    // Show timer display
    if (!elements.timerDisplay) {
        const timerDiv = document.createElement('div');
        timerDiv.id = 'timerDisplay';
        timerDiv.className = 'timer-display';
        document.querySelector('.chat-info').appendChild(timerDiv);
        elements.timerDisplay = timerDiv;
    }
    
    elements.timerDisplay.style.display = 'block';
    updateTimerDisplay();
    
    state.timer = setInterval(() => {
        state.timeRemaining--;
        updateTimerDisplay();
        
        // Warning when 5 minutes left
        if (state.timeRemaining === 5 * 60) {
            addAIMessage("⚠️ **Time Warning!** Only 5 minutes remaining in this round.");
        }
        
        // Warning when 1 minute left
        if (state.timeRemaining === 60) {
            addAIMessage("🚨 **Final Warning!** Only 1 minute remaining!");
        }
        
        // Time's up
        if (state.timeRemaining <= 0) {
            clearInterval(state.timer);
            timeUp();
        }
    }, 1000);
}

function updateTimerDisplay() {
    if (!elements.timerDisplay) return;
    
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    elements.timerDisplay.innerHTML = `⏰ Time: ${timeString}`;
    
    // Change color when time is running low
    if (state.timeRemaining <= 5 * 60) {
        elements.timerDisplay.style.color = '#dc3545'; // Red
    } else if (state.timeRemaining <= 10 * 60) {
        elements.timerDisplay.style.color = '#ffc107'; // Yellow
    } else {
        elements.timerDisplay.style.color = '#ffffff'; // White
    }
}

async function timeUp() {
    // Disable all MCQ options
    const options = elements.mcqOptions.querySelectorAll('.mcq-option');
    options.forEach(option => {
        option.disabled = true;
    });
    
    await addAIMessage("⏰ **Time's Up!** The 30-minute time limit has been reached. Let me calculate your final score based on the questions you've answered.");
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await endRound();
}

function stopTimer() {
    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }
    if (elements.timerDisplay) {
        elements.timerDisplay.style.display = 'none';
    }
}

async function generateQuestion(roundNumber, questionNumber) {
    try {
        showTypingIndicator();
        
        const response = await fetch('/api/generate_question', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                round_number: roundNumber, 
                question_number: questionNumber 
            })
        });
        
        const data = await response.json();
        hideTypingIndicator();
        
        if (data.success) {
            state.currentQuestionData = data.question;
            
            if (data.question.type === 'mcq') {
                await displayMCQQuestion(data.question);
            } else {
                await displayCodingProblem(data.question);
            }
        } else {
            await addAIMessage(`I'm having trouble generating the question: ${data.message}`);
        }
    } catch (error) {
        hideTypingIndicator();
        console.error('Error generating question:', error);
        await addAIMessage("I'm having trouble generating questions right now. Please try again later.");
    }
}

async function displayMCQQuestion(questionData) {
    elements.questionCounter.textContent = `Question ${questionData.question_number}/${questionData.total_questions}`;
    
    // Store question for review
    state.allQuestions[questionData.question_number - 1] = questionData;
    
    await addAIMessage(`**Question ${questionData.question_number}/${questionData.total_questions}**\n\n${questionData.question}`);
    
    // Show hint if available (for demo/admin users)
    if (questionData.hint) {
        await addAIMessage(questionData.hint);
    }
    
    // Clear previous options
    elements.mcqOptions.innerHTML = '';
    
    // Create option buttons
    Object.entries(questionData.options).forEach(([key, value]) => {
        const button = document.createElement('button');
        button.className = 'mcq-option';
        button.textContent = `${key}) ${value}`;
        button.addEventListener('click', () => selectOption(key, questionData.question_number));
        elements.mcqOptions.appendChild(button);
    });
    
    // Add action buttons
    const actionDiv = document.createElement('div');
    actionDiv.className = 'question-actions';
    actionDiv.innerHTML = `
        <button id="submitAnswer" class="btn primary" disabled>Submit Answer</button>
        <button id="saveForLater" class="btn secondary" disabled>Save for Later</button>
        <button id="reviewAnswers" class="btn secondary">Review All Answers</button>
        <div class="selected-answer" id="selectedAnswer" style="display: none;"></div>
    `;
    
    elements.mcqOptions.appendChild(actionDiv);
    
    // Add event listeners for action buttons
    document.getElementById('submitAnswer').addEventListener('click', () => submitCurrentAnswer(questionData));
    document.getElementById('saveForLater').addEventListener('click', () => saveForLater(questionData));
    document.getElementById('reviewAnswers').addEventListener('click', () => showReviewPage());
    
    // Pre-select if already answered
    if (state.selectedAnswers[questionData.question_number]) {
        selectOption(state.selectedAnswers[questionData.question_number], questionData.question_number);
    }
}

function selectOption(selectedKey, questionNumber) {
    // Update visual selection
    const options = elements.mcqOptions.querySelectorAll('.mcq-option');
    options.forEach(option => {
        option.classList.remove('selected');
        if (option.textContent.startsWith(selectedKey)) {
            option.classList.add('selected');
        }
    });
    
    // Store selected answer
    state.selectedAnswers[questionNumber] = selectedKey;
    
    // Enable action buttons
    document.getElementById('submitAnswer').disabled = false;
    document.getElementById('saveForLater').disabled = false;
    
    // Show selected answer
    const selectedDiv = document.getElementById('selectedAnswer');
    selectedDiv.style.display = 'block';
    selectedDiv.innerHTML = `<strong>Selected:</strong> ${selectedKey}`;
}

async function submitCurrentAnswer(questionData) {
    const selectedOption = state.selectedAnswers[questionData.question_number];
    if (!selectedOption) {
        alert('Please select an answer first!');
        return;
    }
    
    await addUserMessage(`Submitted answer for Question ${questionData.question_number}: ${selectedOption}`);
    
    // Move to next question or show completion
    if (questionData.question_number < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await generateQuestion(state.currentRound, questionData.question_number + 1);
    } else {
        await showCompletionOptions();
    }
}

async function saveForLater(questionData) {
    const selectedOption = state.selectedAnswers[questionData.question_number];
    if (!selectedOption) {
        alert('Please select an answer first!');
        return;
    }
    
    await addUserMessage(`Saved answer for Question ${questionData.question_number}: ${selectedOption}`);
    
    // Move to next question
    if (questionData.question_number < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await generateQuestion(state.currentRound, questionData.question_number + 1);
    } else {
        await showCompletionOptions();
    }
}

async function showCompletionOptions() {
    const answeredCount = Object.keys(state.selectedAnswers).length;
    const unansweredCount = 10 - answeredCount;
    
    let message = `🎯 **Round ${state.currentRound} Complete!**\n\n`;
    message += `📊 **Status:**\n`;
    message += `✅ Answered: ${answeredCount}/10 questions\n`;
    
    if (unansweredCount > 0) {
        message += `❓ Unanswered: ${unansweredCount} questions\n\n`;
        message += `⚠️ **Note:** Unanswered questions will be marked as incorrect.\n\n`;
    }
    
    message += `What would you like to do?`;
    
    await addAIMessage(message);
    
    // Show completion action buttons
    elements.mcqOptions.innerHTML = `
        <div class="completion-actions">
            <button id="reviewBeforeSubmit" class="btn primary">📋 Review All Answers</button>
            <button id="submitAllAnswers" class="btn success">✅ Submit All Answers</button>
        </div>
    `;
    
    document.getElementById('reviewBeforeSubmit').addEventListener('click', () => showReviewPage());
    document.getElementById('submitAllAnswers').addEventListener('click', () => submitAllAnswers());
}

function showReviewPage() {
    state.isReviewMode = true;
    
    // Clear chat and show review interface
    elements.chatMessages.innerHTML = '';
    
    addAIMessage(`📋 **Review Your Answers - Round ${state.currentRound}**\n\nHere are all the questions and your selected answers. You can change any answer before final submission.`);
    
    // Create review interface
    elements.mcqOptions.innerHTML = '<div class="review-container"></div>';
    const reviewContainer = elements.mcqOptions.querySelector('.review-container');
    
    // Show all questions with answers
    state.allQuestions.forEach((questionData, index) => {
        if (!questionData) return;
        
        const questionDiv = document.createElement('div');
        questionDiv.className = 'review-question';
        
        const selectedAnswer = state.selectedAnswers[questionData.question_number];
        const answerStatus = selectedAnswer ? `Selected: ${selectedAnswer}` : 'Not answered';
        const statusClass = selectedAnswer ? 'answered' : 'unanswered';
        
        questionDiv.innerHTML = `
            <div class="question-header">
                <h4>Question ${questionData.question_number}/10</h4>
                <span class="answer-status ${statusClass}">${answerStatus}</span>
            </div>
            <div class="question-text">${questionData.question}</div>
            <div class="review-options" data-question="${questionData.question_number}">
                ${Object.entries(questionData.options).map(([key, value]) => `
                    <label class="review-option ${selectedAnswer === key ? 'selected' : ''}">
                        <input type="radio" name="question_${questionData.question_number}" value="${key}" ${selectedAnswer === key ? 'checked' : ''}>
                        <span>${key}) ${value}</span>
                    </label>
                `).join('')}
            </div>
        `;
        
        reviewContainer.appendChild(questionDiv);
    });
    
    // Add final submit buttons
    const submitDiv = document.createElement('div');
    submitDiv.className = 'final-submission';
    submitDiv.innerHTML = `
        <div class="submission-summary">
            <h3>📊 Submission Summary</h3>
            <p>Answered: <span id="answeredCount">${Object.keys(state.selectedAnswers).length}</span>/10</p>
            <p>Unanswered: <span id="unansweredCount">${10 - Object.keys(state.selectedAnswers).length}</span>/10</p>
        </div>
        <div class="submission-actions">
            <button id="backToQuestions" class="btn secondary">← Back to Questions</button>
            <button id="finalSubmit" class="btn success">🚀 Submit Final Answers</button>
        </div>
    `;
    
    reviewContainer.appendChild(submitDiv);
    
    // Add event listeners for review options
    reviewContainer.addEventListener('change', (e) => {
        if (e.target.type === 'radio') {
            const questionNumber = parseInt(e.target.name.split('_')[1]);
            const selectedValue = e.target.value;
            
            // Update state
            state.selectedAnswers[questionNumber] = selectedValue;
            
            // Update visual selection
            const questionDiv = e.target.closest('.review-question');
            questionDiv.querySelectorAll('.review-option').forEach(option => {
                option.classList.remove('selected');
            });
            e.target.closest('.review-option').classList.add('selected');
            
            // Update answer status
            const statusSpan = questionDiv.querySelector('.answer-status');
            statusSpan.textContent = `Selected: ${selectedValue}`;
            statusSpan.classList.remove('unanswered');
            statusSpan.classList.add('answered');
            
            // Update summary
            document.getElementById('answeredCount').textContent = Object.keys(state.selectedAnswers).length;
            document.getElementById('unansweredCount').textContent = 10 - Object.keys(state.selectedAnswers).length;
        }
    });
    
    document.getElementById('backToQuestions').addEventListener('click', () => {
        console.log('Back to Questions clicked');
        backToQuestions();
    });
    document.getElementById('finalSubmit').addEventListener('click', () => {
        console.log('Final Submit clicked');
        submitAllAnswers();
    });
}

async function backToQuestions() {
    console.log('backToQuestions called');
    state.isReviewMode = false;
    
    // Clear chat and restore normal question view
    elements.chatMessages.innerHTML = '';
    
    // Find the last question that was being displayed or first unanswered question
    let nextQuestion = 1;
    for (let i = 1; i <= 10; i++) {
        if (!state.selectedAnswers[i]) {
            nextQuestion = i;
            break;
        }
        nextQuestion = i;
    }
    
    console.log('Next question to show:', nextQuestion);
    
    // If all questions are answered, go to the last question or show completion
    if (Object.keys(state.selectedAnswers).length === 10) {
        await showCompletionOptions();
    } else {
        // Show the next unanswered question or continue from where we left off
        await addAIMessage("Returning to questions. You can continue answering or reviewing your selections.");
        
        // Find the question data to display
        const questionToShow = state.allQuestions[nextQuestion - 1];
        if (questionToShow) {
            await displayMCQQuestion(questionToShow);
        } else {
            // Generate next question if it doesn't exist
            await generateQuestion(state.currentRound, nextQuestion);
        }
    }
}

async function submitAllAnswers() {
    console.log('submitAllAnswers called');
    console.log('Current state:', {
        currentRound: state.currentRound,
        allQuestions: state.allQuestions.length,
        selectedAnswers: Object.keys(state.selectedAnswers).length
    });
    
    // Stop timer
    stopTimer();
    
    // Clear the MCQ options to prevent further interaction
    elements.mcqOptions.innerHTML = '';
    
    await addAIMessage("🔄 **Processing your answers...** Please wait while I calculate your score.");
    
    let correctCount = 0;
    const results = [];
    
    // Process all answers
    for (let i = 1; i <= 10; i++) {
        const questionData = state.allQuestions[i - 1];
        const selectedAnswer = state.selectedAnswers[i] || null;
        
        if (questionData && selectedAnswer) {
            const isCorrect = selectedAnswer === questionData.correct_answer;
            if (isCorrect) correctCount++;
            
            results.push({
                question: i,
                selected: selectedAnswer,
                correct: questionData.correct_answer,
                isCorrect
            });
        } else {
            results.push({
                question: i,
                selected: null,
                correct: questionData?.correct_answer || 'N/A',
                isCorrect: false
            });
        }
    }
    
    console.log('Results to submit:', { correctCount, results: results.length });
    
    // Submit to backend
    try {
        const response = await fetch('/api/submit_all_answers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                round_number: state.currentRound,
                answers: results,
                score: correctCount
            })
        });
        
        const data = await response.json();
        console.log('Backend response:', data);
        
        if (data.success) {
            state.score = correctCount;
            await new Promise(resolve => setTimeout(resolve, 1000));
            await addAIMessage(data.message);
            state.roundScores = data.round_scores;
            
            // After MCQ round completion, check if we should redirect to completion page
            // This will only happen for rounds 1 and 2 when all rounds are completed
            const allCompleted = state.roundScores.round1 !== null && 
                               state.roundScores.round2 !== null && 
                               state.roundScores.round3 !== null;
            
            if (allCompleted) {
                // All rounds completed, redirect to completion page
                await new Promise(resolve => setTimeout(resolve, 3000));
                await addAIMessage("🎯 **Redirecting you to your detailed completion report...**");
                await new Promise(resolve => setTimeout(resolve, 2000));
                window.location.href = '/completion';
            }
        } else {
            await addAIMessage(`Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error submitting answers:', error);
        await addAIMessage("There was an error submitting your answers. Please try again.");
    }
}

async function displayCodingProblem(problemData) {
    elements.questionCounter.textContent = `Problem ${problemData.problem_number}/${problemData.total_problems}`;
    
    await addAIMessage(`**Problem ${problemData.problem_number}/${problemData.total_problems}**\n\n${problemData.problem_text}`);
    
    // Clear code editor
    elements.codeEditor.value = '';
}

async function handleCodeSubmission() {
    const code = elements.codeEditor.value.trim();
    if (!code) {
        alert('Please write some code before submitting!');
        return;
    }
    
    elements.submitCode.disabled = true;
    elements.submitCode.textContent = 'Evaluating...';
    
    await addUserMessage(`Submitted solution:\n\`\`\`python\n${code}\n\`\`\``);
    
    try {
        showTypingIndicator();
        
        const response = await fetch('/api/submit_code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                problem_text: state.currentQuestionData.problem_text,
                problem_number: state.currentQuestionData.problem_number
            })
        });
        
        const data = await response.json();
        hideTypingIndicator();
        
        if (data.success) {
            if (data.is_passed) {
                await addAIMessage(`✅ **Excellent!** Your solution is correct.\n\n${data.feedback}`);
            } else {
                await addAIMessage(`❌ **Not quite right.** Let me explain:\n\n${data.feedback}`);
            }
            
            state.score = data.current_score;
            
            // Move to next problem or end round
            if (state.currentQuestionData.problem_number < 2) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                await generateQuestion(state.currentRound, 2);
            } else {
                await endRound();
            }
        } else {
            await addAIMessage(`Error: ${data.message}`);
        }
    } catch (error) {
        hideTypingIndicator();
        console.error('Error submitting code:', error);
        await addAIMessage("I'm having trouble evaluating your code right now. Please try again.");
    }
    
    elements.submitCode.disabled = false;
    elements.submitCode.textContent = 'Submit Solution';
}

async function endRound() {
    // Stop the timer
    stopTimer();
    
    try {
        const response = await fetch('/api/end_round', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await addAIMessage(data.message);
            
            // Update local state
            state.roundScores = data.round_scores;
            
            // Check if all rounds are completed after Round 3
            if (state.currentRound === 3) {
                const allCompleted = state.roundScores.round1 !== null && 
                                   state.roundScores.round2 !== null && 
                                   state.roundScores.round3 !== null;
                
                if (allCompleted) {
                    // Show completion message and redirect after delay
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    await addAIMessage("🎯 **Redirecting you to your detailed completion report...**");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    window.location.href = '/completion';
                    return;
                }
            }
        }
    } catch (error) {
        console.error('Error ending round:', error);
        await addAIMessage("There was an error processing your results. Please contact support.");
    }
}

async function addAIMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">${message.replace(/\n/g, '<br>')}</div>
    `;
    
    elements.chatMessages.appendChild(messageDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    
    // Add typing animation
    await new Promise(resolve => setTimeout(resolve, 1000));
}

async function addUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
        <div class="message-avatar">👤</div>
        <div class="message-content">${message}</div>
    `;
    
    elements.chatMessages.appendChild(messageDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message ai';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    
    elements.chatMessages.appendChild(indicator);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Admin Functions
async function bypassToRound(roundNumber) {
    if (!confirm(`Are you sure you want to bypass to Round ${roundNumber}? This will mark all previous rounds as passed.`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin_bypass_round', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ round_number: roundNumber })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            state.roundScores = data.round_scores;
            updateDashboard();
            
            // Check if all rounds are completed after bypass
            const allCompleted = state.roundScores.round1 !== null && 
                               state.roundScores.round2 !== null && 
                               state.roundScores.round3 !== null;
            
            if (allCompleted) {
                // Wait a moment for the user to see the success message, then redirect
                setTimeout(() => {
                    if (confirm('All rounds completed! Would you like to view the final results page?')) {
                        window.location.href = '/completion';
                    }
                }, 1000);
            }
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Bypass error:', error);
        alert('Failed to bypass round');
    }
}

async function clearAllProgress() {
    if (!confirm('Are you sure you want to clear all progress? This will reset all rounds.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/clear_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reset frontend state
            state.roundScores = { round1: null, round2: null, round3: null };
            updateDashboard();
            alert('All progress cleared!');
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Clear error:', error);
        alert('Failed to clear progress');
    }
}
