// Application State
const state = {
    currentUser: null,
    currentRound: null,
    currentQuestion: 0,
    score: 0,
    answers: [],
    roundScores: { round1: null, round2: null, round3: null },
    questions: {
        round1: [], // Will be populated by AI
        round2: [], // Will be populated by AI
        round3: []  // Will be populated by AI
    },
    timer: null,
    timeRemaining: 0
};

// OpenAI Configuration
const OPENAI_API_KEY = "";

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
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    mcqOptions: document.getElementById('mcqOptions'),
    codingArea: document.getElementById('codingArea'),
    codeEditor: document.getElementById('codeEditor'),
    submitCode: document.getElementById('submitCode'),
    backToDashboard: document.getElementById('backToDashboard'),
    chatTitle: document.getElementById('chatTitle'),
    roundInfo: document.getElementById('roundInfo'),
    questionCounter: document.getElementById('questionCounter'),
    timerDisplay: document.getElementById('timerDisplay')
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
    
    // Chat input
    elements.chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !elements.sendBtn.disabled) {
            handleSendMessage();
        }
    });
    
    elements.sendBtn.addEventListener('click', handleSendMessage);
    
    // Code submission
    elements.submitCode.addEventListener('click', handleCodeSubmission);
    
    // Back to dashboard
    elements.backToDashboard.addEventListener('click', () => {
        stopTimer();
        showPage('dashboard');
    });
}

function showPage(pageId) {
    Object.values(pages).forEach(page => page.classList.remove('active'));
    pages[pageId].classList.add('active');
}

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (username === 'demo' && password === '1234') {
        state.currentUser = username;
        showPage('dashboard');
        updateDashboard();
    } else {
        alert('Invalid credentials! Use demo/1234');
    }
}

function handleLogout() {
    state.currentUser = null;
    state.currentRound = null;
    state.currentQuestion = 0;
    state.score = 0;
    state.answers = [];
    state.roundScores = { round1: null, round2: null, round3: null };
    showPage('login');
    document.getElementById('loginForm').reset();
}

function updateDashboard() {
    const { roundScores } = state;
    
    // Update round 1 status
    updateRoundCard(1, roundScores.round1);
    
    // Update round 2 status
    updateRoundCard(2, roundScores.round2);
    
    // Update round 3 status
    updateRoundCard(3, roundScores.round3);
}

function updateRoundCard(round, score) {
    const card = document.getElementById(`round${round}Card`);
    const status = document.getElementById(`round${round}Status`);
    const button = document.getElementById(`startRound${round}`);
    
    if (score === null) {
        // Not attempted
        if (round === 1 || (round === 2 && state.roundScores.round1 >= 7) || (round === 3 && state.roundScores.round2 >= 7)) {
            card.classList.remove('locked');
            status.textContent = 'Ready to start';
            button.disabled = false;
            button.classList.remove('disabled');
        } else {
            card.classList.add('locked');
            status.textContent = `🔒 Complete Round ${round - 1} first`;
            button.disabled = true;
            button.classList.add('disabled');
        }
    } else if (score >= 7 || (round === 3 && score > 0)) {
        // Passed
        card.classList.remove('locked');
        card.classList.add('completed');
        status.textContent = round === 3 ? '✅ Completed' : `✅ Passed (${score}/10)`;
        button.textContent = 'Retake';
        button.disabled = false;
        button.classList.remove('disabled');
    } else {
        // Failed
        card.classList.remove('locked');
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
    
    showPage('chat');
    setupChatInterface(roundNumber);
    
    // Clear previous messages
    elements.chatMessages.innerHTML = '';
    
    // Start the conversation
    await initializeRound(roundNumber);
}

function setupChatInterface(roundNumber) {
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
    elements.chatInput.style.display = 'none';
    elements.sendBtn.style.display = 'none';
    elements.mcqOptions.style.display = roundNumber === 3 ? 'none' : 'block';
    elements.codingArea.style.display = roundNumber === 3 ? 'block' : 'none';
    
    // Start timer for MCQ rounds (30 minutes)
    if (roundNumber !== 3) {
        startTimer(30 * 60); // 30 minutes in seconds
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
    await endMCQRound();
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

async function initializeRound(roundNumber) {
    const welcomeMessages = {
        1: "Hello! I'm your AI interview assistant. 🤖\n\nWelcome to Round 1 - Screening! This round tests your aptitude and reasoning skills.\n\nYou'll face 10 multiple-choice questions in 30 minutes. You need to score at least 7/10 to proceed to the next round.\n\nAre you ready to begin? Let's start with your first question!",
        2: "Excellent work on Round 1! 🎉\n\nWelcome to Round 2 - Technical Assessment! This round focuses on Python programming and AI/ML concepts.\n\nYou have 10 multiple-choice questions with 30 minutes time limit. Minimum score requirement is 7/10.\n\nLet's dive into the technical questions!",
        3: "Outstanding! You've made it to the final round! 🚀\n\nWelcome to Round 3 - Coding Challenge! Here you'll solve 2 Python programming problems.\n\nBoth problems need to be solved correctly to pass this round.\n\nTake your time, think through the problems, and write clean, efficient code.\n\nLet's start with your first coding problem!"
    };
    
    await addAIMessage(welcomeMessages[roundNumber]);
    
    if (roundNumber === 3) {
        await generateCodingQuestion(1);
    } else {
        await generateMCQQuestion(roundNumber, 1);
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

async function generateMCQQuestion(round, questionNumber) {
    try {
        showTypingIndicator();
        
        const prompts = {
            1: `Generate a challenging aptitude or reasoning question for a software engineering interview. This is question ${questionNumber} of 10.

Make it about: logical reasoning, quantitative aptitude, pattern recognition, or analytical thinking.

Format your response as:
QUESTION: [The question]
A) [Option A]
B) [Option B]  
C) [Option C]
D) [Option D]
CORRECT: [A/B/C/D]

Make the question challenging but fair for a software engineering candidate.`,
            
            2: `Generate a technical multiple choice question about Python programming or AI/ML for a software engineering interview. This is question ${questionNumber} of 10.

Topics can include: Python syntax, data structures, algorithms, machine learning concepts, data science, frameworks like pandas/numpy/sklearn, or general programming concepts.

Format your response as:
QUESTION: [The question]
A) [Option A]
B) [Option B]  
C) [Option C]
D) [Option D]
CORRECT: [A/B/C/D]

Make it appropriately technical for a software engineer role.`
        };
        
        const response = await callOpenAI(prompts[round]);
        hideTypingIndicator();
        
        const question = parseQuestionResponse(response);
        if (question) {
            await displayMCQQuestion(question, questionNumber);
        } else {
            await addAIMessage("I apologize, there was an issue generating the question. Let me try again.");
            await generateMCQQuestion(round, questionNumber);
        }
        
    } catch (error) {
        hideTypingIndicator();
        console.error('Error generating question:', error);
        await addAIMessage("I'm having trouble generating questions right now. Please try again later.");
    }
}

async function generateCodingQuestion(problemNumber) {
    try {
        showTypingIndicator();
        
        const prompts = {
            1: `Generate a Python coding problem suitable for a software engineering interview. This should be moderately challenging but solvable in reasonable time.

The problem should test:
- Problem-solving skills
- Python programming fundamentals
- Algorithm/data structure knowledge

Format your response as:
PROBLEM: [Clear problem description with examples]
SAMPLE_INPUT: [Example input]
SAMPLE_OUTPUT: [Expected output]

Make it engaging and realistic for a software engineering role.`,
            
            2: `Generate a second Python coding problem, different from typical array/string problems. This should be slightly more challenging.

Focus on:
- Object-oriented programming
- Data structures (trees, graphs, etc.)
- Algorithmic thinking

Format your response as:
PROBLEM: [Clear problem description with examples]
SAMPLE_INPUT: [Example input]  
SAMPLE_OUTPUT: [Expected output]

Make it a good test of programming maturity and problem-solving skills.`
        };
        
        const response = await callOpenAI(prompts[problemNumber]);
        hideTypingIndicator();
        
        await displayCodingProblem(response, problemNumber);
        
    } catch (error) {
        hideTypingIndicator();
        console.error('Error generating coding problem:', error);
        await addAIMessage("I'm having trouble generating the coding problem. Please try again later.");
    }
}

function parseQuestionResponse(response) {
    try {
        const lines = response.split('\n').filter(line => line.trim());
        
        let question = '';
        const options = {};
        let correct = '';
        
        for (const line of lines) {
            if (line.startsWith('QUESTION:')) {
                question = line.replace('QUESTION:', '').trim();
            } else if (line.match(/^[A-D]\)/)) {
                const option = line.charAt(0);
                const text = line.substring(2).trim();
                options[option] = text;
            } else if (line.startsWith('CORRECT:')) {
                correct = line.replace('CORRECT:', '').trim();
            }
        }
        
        if (question && Object.keys(options).length === 4 && correct) {
            return { question, options, correct };
        }
        
        return null;
    } catch (error) {
        console.error('Error parsing question:', error);
        return null;
    }
}

async function displayMCQQuestion(questionData, questionNumber) {
    const totalQuestions = 10;
    elements.questionCounter.textContent = `Question ${questionNumber}/${totalQuestions}`;
    
    await addAIMessage(`**Question ${questionNumber}/${totalQuestions}**\n\n${questionData.question}`);
    
    // Clear previous options
    elements.mcqOptions.innerHTML = '';
    
    // Create option buttons
    Object.entries(questionData.options).forEach(([key, value]) => {
        const button = document.createElement('button');
        button.className = 'mcq-option';
        button.textContent = `${key}) ${value}`;
        button.addEventListener('click', () => selectMCQOption(key, questionData.correct, questionNumber));
        elements.mcqOptions.appendChild(button);
    });
}

async function displayCodingProblem(problemText, problemNumber) {
    elements.questionCounter.textContent = `Problem ${problemNumber}/2`;
    
    await addAIMessage(`**Problem ${problemNumber}/2**\n\n${problemText}`);
    
    // Clear code editor
    elements.codeEditor.value = '';
    
    // Store current problem for evaluation
    state.currentCodingProblem = { text: problemText, number: problemNumber };
}

async function selectMCQOption(selectedOption, correctOption, questionNumber) {
    // Disable all options
    const options = elements.mcqOptions.querySelectorAll('.mcq-option');
    options.forEach(option => {
        option.disabled = true;
        if (option.textContent.startsWith(selectedOption)) {
            option.classList.add('selected');
        }
    });
    
    const isCorrect = selectedOption === correctOption;
    if (isCorrect) {
        state.score++;
    }
    
    state.answers.push({
        question: questionNumber,
        selected: selectedOption,
        correct: correctOption,
        isCorrect
    });
    
    // Add user response
    await addUserMessage(`Selected: ${selectedOption}`);
    
    // AI feedback
    const feedback = isCorrect 
        ? "✅ Correct! Well done."
        : `❌ Incorrect. The correct answer was ${correctOption}.`;
    
    await addAIMessage(feedback);
    
    // Move to next question or end round
    if (questionNumber < 10) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await generateMCQQuestion(state.currentRound, questionNumber + 1);
    } else {
        await endMCQRound();
    }
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
        
        const evaluationPrompt = `Evaluate this Python code solution for the given problem:

PROBLEM: ${state.currentCodingProblem.text}

SUBMITTED CODE:
${code}

Please evaluate:
1. Does it solve the problem correctly?
2. Is the logic sound?
3. Are there any syntax errors?
4. Is it reasonably efficient?

Respond with:
EVALUATION: [PASS/FAIL]
FEEDBACK: [Detailed feedback about the solution]

Be thorough but fair in your evaluation.`;
        
        const evaluation = await callOpenAI(evaluationPrompt);
        hideTypingIndicator();
        
        const isPassed = evaluation.includes('EVALUATION: PASS');
        const feedback = evaluation.split('FEEDBACK:')[1]?.trim() || 'Solution evaluated.';
        
        if (isPassed) {
            state.score++;
            await addAIMessage(`✅ **Excellent!** Your solution is correct.\n\n${feedback}`);
        } else {
            await addAIMessage(`❌ **Not quite right.** Let me explain:\n\n${feedback}`);
        }
        
        state.answers.push({
            problem: state.currentCodingProblem.number,
            code,
            isPassed,
            feedback
        });
        
        // Move to next problem or end round
        if (state.currentCodingProblem.number < 2) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await generateCodingQuestion(2);
        } else {
            await endCodingRound();
        }
        
    } catch (error) {
        hideTypingIndicator();
        console.error('Error evaluating code:', error);
        await addAIMessage("I'm having trouble evaluating your code right now. Please try again.");
    }
    
    elements.submitCode.disabled = false;
    elements.submitCode.textContent = 'Submit Solution';
}

async function endMCQRound() {
    // Stop the timer
    stopTimer();
    
    const roundNumber = state.currentRound;
    const score = state.score;
    const passed = score >= 7;
    
    state.roundScores[`round${roundNumber}`] = score;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (passed) {
        const successMessage = roundNumber === 1 
            ? `🎉 **Congratulations!** You scored ${score}/10 in Round 1!\n\nYou've successfully passed the screening round. Your analytical and reasoning skills are impressive!\n\n✅ **Ready for Round 2?** Head back to the dashboard to start the technical assessment.`
            : `🎉 **Outstanding!** You scored ${score}/10 in Round 2!\n\nYour technical knowledge of Python and AI/ML is solid. You're ready for the final challenge!\n\n✅ **Ready for Round 3?** Return to the dashboard to begin the coding challenge.`;
        
        await addAIMessage(successMessage);
    } else {
        const encouragementMessage = `Thank you for attempting Round ${roundNumber}! You scored ${score}/10.\n\n💪 **Don't give up!** Every great developer has faced challenges. This is just a stepping stone in your journey.\n\n📚 **Consider reviewing:**\n${roundNumber === 1 ? '- Logical reasoning techniques\n- Quantitative problem-solving\n- Pattern recognition skills' : '- Python fundamentals\n- AI/ML concepts\n- Programming best practices'}\n\n🚀 **You can retry this round anytime.** I believe in your potential!`;
        
        await addAIMessage(encouragementMessage);
    }
    
    // Update dashboard
    updateDashboard();
}

async function endCodingRound() {
    const score = state.score;
    const passed = score === 2;
    
    state.roundScores.round3 = score;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (passed) {
        await addAIMessage(`🎊 **CONGRATULATIONS!** 🎊\n\nYou've successfully completed all three rounds of the interview process!\n\n✅ **Your Journey:**\n- Round 1: ${state.roundScores.round1}/10 (Screening)\n- Round 2: ${state.roundScores.round2}/10 (Technical)\n- Round 3: 2/2 Problems Solved (Coding)\n\n🌟 **What's Next?**\nOur team is thoroughly impressed with your performance. You've demonstrated excellent problem-solving skills, technical knowledge, and coding abilities.\n\n📞 **We'll contact you soon** with the next steps in the hiring process!\n\nThank you for your time and effort. Welcome to the team! 🚀`);
    } else {
        await addAIMessage(`Thank you for your effort in the coding round! You solved ${score}/2 problems correctly.\n\n💡 **Remember:** Great programmers are made through practice and persistence. Every line of code you write makes you stronger.\n\n🎯 **Areas to focus on:**\n- Algorithm design and implementation\n- Problem decomposition\n- Code optimization\n- Testing and debugging\n\n🔄 **Feel free to retry** when you're ready. I'm here to help you succeed!\n\nYour determination to improve is already a sign of a great developer mindset! 💪`);
    }
    
    // Update dashboard
    updateDashboard();
}

async function callOpenAI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert AI interview assistant. Generate high-quality, fair, and challenging interview questions. Be precise and follow the requested format exactly.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
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
