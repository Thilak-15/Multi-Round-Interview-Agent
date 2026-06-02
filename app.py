
from flask import Flask, render_template, request, jsonify, session, redirect, redirect
import openai
import os
from dotenv import load_dotenv
import re
import json

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = 'interview_agent_secret_key_2026'

# Session configuration for development
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_TYPE'] = 'filesystem'

# OpenAI Configuration
openai.api_key = os.getenv('OPENAI_API_KEY')
client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Demo/Testing Configuration
DEMO_MODE = True  # Set to True for easier testing
ADMIN_USERNAME = 'admin'  # Admin user with bypass capabilities
ADMIN_PASSWORD = 'test123'  # Admin password

class InterviewAgent:
    def __init__(self):
        pass
    
    def reset_session(self):
        """Reset all session data"""
        session['current_user'] = None
        session['current_round'] = None
        session['current_question'] = 0
        session['score'] = 0
        session['answers'] = []
        session['round_scores'] = {'round1': None, 'round2': None, 'round3': None}
        session['questions'] = {'round1': [], 'round2': [], 'round3': []}

# Create interview agent instance
interview_agent = InterviewAgent()

@app.route('/')
def landing():
    """Serve the landing page with interview invitation"""
    from datetime import datetime
    current_date = datetime.now().strftime("%B %d, %Y")
    return render_template('landing.html', current_date=current_date)

@app.route('/interview')
def interview():
    """Serve the main interview application page"""
    return render_template('index.html')

@app.route('/completion')
def completion():
    """Serve the interview completion page"""
    print(f"Completion route accessed. Current user: {session.get('current_user')}")
    print(f"Round scores: {session.get('round_scores')}")
    
    if not session.get('current_user'):
        print("No current user in session, redirecting to login")
        return redirect('/interview')  # Redirect to interview page instead of login
    
    # Check if all rounds are completed
    round_scores = session.get('round_scores', {'round1': None, 'round2': None, 'round3': None})
    
    if not all(score is not None for score in round_scores.values()):
        # Not all rounds completed, redirect to dashboard
        print("Not all rounds completed, redirecting to interview")
        return redirect('/interview')
    
    # Generate a unique interview ID
    from datetime import datetime
    interview_id = datetime.now().strftime('%Y%m%d%H%M')
    
    return render_template('completion.html', 
                         round_scores=round_scores,
                         interview_id=interview_id)

@app.route('/api/login', methods=['POST'])
def login():
    """Handle user login"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if username == 'demo' and password == '1234':
        # Clear any existing session data first
        session.clear()
        
        # Initialize fresh session
        session['current_user'] = username
        session['user_type'] = 'demo'
        session['current_round'] = None
        session['current_question'] = 0
        session['score'] = 0
        session['answers'] = []
        session['round_scores'] = {'round1': None, 'round2': None, 'round3': None}
        session['questions'] = {'round1': [], 'round2': [], 'round3': []}
        
        return jsonify({'success': True, 'message': 'Login successful', 'user_type': 'demo'})
    elif username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        # Admin login bypass
        session.clear()
        session['current_user'] = username
        session['user_type'] = 'admin'
        session['current_round'] = None
        session['current_question'] = 0
        session['score'] = 0
        session['answers'] = []
        session['round_scores'] = {'round1': None, 'round2': None, 'round3': None}
        session['questions'] = {'round1': [], 'round2': [], 'round3': []}
        
        return jsonify({'success': True, 'message': 'Admin login successful', 'user_type': 'admin'})
    else:
        return jsonify({'success': False, 'message': 'Invalid credentials! Use demo/1234 or admin/test123'})

@app.route('/api/logout', methods=['POST'])
def logout():
    """Handle user logout"""
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/api/start_round', methods=['POST'])
def start_round():
    """Start a specific round"""
    if not session.get('current_user'):
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.json
    round_number = data.get('round_number')
    
    # Reset round-specific data
    session['current_round'] = round_number
    session['current_question'] = 0
    session['score'] = 0
    session['answers'] = []
    
    # Get welcome message
    welcome_messages = {
        1: "Hello! I'm your AI interview assistant. 🤖\n\nWelcome to Round 1 - Screening! This round tests your aptitude and reasoning skills.\n\nYou'll face 10 multiple-choice questions in 30 minutes. You need to score at least 7/10 to proceed to the next round.\n\nAre you ready to begin? Let's start with your first question!",
        2: "Excellent work on Round 1! 🎉\n\nWelcome to Round 2 - Technical Assessment! This round focuses on Python programming and AI/ML concepts.\n\nYou have 10 multiple-choice questions with 30 minutes time limit. Minimum score requirement is 7/10.\n\nLet's dive into the technical questions!",
        3: "Outstanding! You've made it to the final round! 🚀\n\nWelcome to Round 3 - Coding Challenge! Here you'll solve 2 Python programming problems.\n\nBoth problems need to be solved correctly to pass this round.\n\nTake your time, think through the problems, and write clean, efficient code.\n\nLet's start with your first coding problem!"
    }
    
    return jsonify({
        'success': True,
        'welcome_message': welcome_messages.get(round_number, "Welcome to the interview round!"),
        'round_info': {
            'round_number': round_number,
            'total_questions': 2 if round_number == 3 else 10,
            'is_coding_round': round_number == 3,
            'time_limit': None if round_number == 3 else 30 * 60  # 30 minutes in seconds for MCQ rounds
        }
    })

@app.route('/api/generate_question', methods=['POST'])
def generate_question():
    """Generate MCQ or coding question using OpenAI"""
    if not session.get('current_user'):
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.json
    round_number = data.get('round_number')
    question_number = data.get('question_number', 1)
    
    try:
        if round_number == 3:
            # Generate coding question
            question_data = generate_coding_question(question_number)
        else:
            # Generate MCQ question
            question_data = generate_mcq_question(round_number, question_number)
            
            # Add testing hints for demo/admin users
            user_type = session.get('user_type', 'demo')
            if user_type == 'admin':
                question_data['hint'] = f"🔧 ADMIN HINT: Correct answer is {question_data['correct_answer']}"
            elif DEMO_MODE and user_type == 'demo':
                question_data['hint'] = f"💡 DEMO HINT: Try option {question_data['correct_answer']} for best results!"
        
        return jsonify({'success': True, 'question': question_data})
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error generating question: {str(e)}'})

def generate_mcq_question(round_number, question_number):
    """Generate MCQ question using OpenAI"""
    prompts = {
        1: f"""Generate a challenging aptitude or reasoning question for a software engineering interview. This is question {question_number} of 10.

Make it about: logical reasoning, quantitative aptitude, pattern recognition, or analytical thinking.

Format your response as:
QUESTION: [The question]
A) [Option A]
B) [Option B]  
C) [Option C]
D) [Option D]
CORRECT: [A/B/C/D]

Make the question challenging but fair for a software engineering candidate.""",
        
        2: f"""Generate a technical multiple choice question about Python programming or AI/ML for a software engineering interview. This is question {question_number} of 10.

Topics can include: Python syntax, data structures, algorithms, machine learning concepts, data science, frameworks like pandas/numpy/sklearn, or general programming concepts.

Format your response as:
QUESTION: [The question]
A) [Option A]
B) [Option B]  
C) [Option C]
D) [Option D]
CORRECT: [A/B/C/D]

Make it appropriately technical for a software engineer role."""
    }
    
    response = call_openai(prompts[round_number])
    question_data = parse_mcq_response(response)
    
    if not question_data:
        raise Exception("Failed to parse question response")
    
    return {
        'type': 'mcq',
        'question_number': question_number,
        'total_questions': 10,
        'question': question_data['question'],
        'options': question_data['options'],
        'correct_answer': question_data['correct']
    }

def generate_coding_question(problem_number):
    """Generate coding question using OpenAI"""
    prompts = {
        1: """Generate a Python coding problem suitable for a software engineering interview. This should be moderately challenging but solvable in reasonable time.

The problem should test:
- Problem-solving skills
- Python programming fundamentals
- Algorithm/data structure knowledge

Format your response as:
PROBLEM: [Clear problem description with examples]
SAMPLE_INPUT: [Example input]
SAMPLE_OUTPUT: [Expected output]

Make it engaging and realistic for a software engineering role.""",
        
        2: """Generate a second Python coding problem, different from typical array/string problems. This should be slightly more challenging.

Focus on:
- Object-oriented programming
- Data structures (trees, graphs, etc.)
- Algorithmic thinking

Format your response as:
PROBLEM: [Clear problem description with examples]
SAMPLE_INPUT: [Example input]  
SAMPLE_OUTPUT: [Expected output]

Make it a good test of programming maturity and problem-solving skills."""
    }
    
    response = call_openai(prompts[problem_number])
    
    return {
        'type': 'coding',
        'problem_number': problem_number,
        'total_problems': 2,
        'problem_text': response
    }

def parse_mcq_response(response):
    """Parse OpenAI response for MCQ question"""
    try:
        lines = [line.strip() for line in response.split('\n') if line.strip()]
        
        question = ''
        options = {}
        correct = ''
        
        for line in lines:
            if line.startswith('QUESTION:'):
                question = line.replace('QUESTION:', '').strip()
            elif re.match(r'^[A-D]\)', line):
                option = line[0]
                text = line[2:].strip()
                options[option] = text
            elif line.startswith('CORRECT:'):
                correct = line.replace('CORRECT:', '').strip()
        
        if question and len(options) == 4 and correct:
            return {'question': question, 'options': options, 'correct': correct}
        
        return None
    
    except Exception as e:
        print(f"Error parsing question: {e}")
        return None

@app.route('/api/submit_mcq_answer', methods=['POST'])
def submit_mcq_answer():
    """Submit MCQ answer and get feedback"""
    if not session.get('current_user'):
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.json
    selected_option = data.get('selected_option')
    correct_option = data.get('correct_option')
    question_number = data.get('question_number')
    
    # Check if answer is correct
    is_correct = selected_option == correct_option
    if is_correct:
        session['score'] = session.get('score', 0) + 1
    
    # Store answer
    if 'answers' not in session:
        session['answers'] = []
    
    session['answers'].append({
        'question': question_number,
        'selected': selected_option,
        'correct': correct_option,
        'is_correct': is_correct
    })
    
    # Generate feedback
    feedback = "✅ Correct! Well done." if is_correct else f"❌ Incorrect. The correct answer was {correct_option}."
    
    return jsonify({
        'success': True,
        'is_correct': is_correct,
        'feedback': feedback,
        'current_score': session['score']
    })

@app.route('/api/submit_code', methods=['POST'])
def submit_code():
    """Submit code solution for evaluation"""
    if not session.get('current_user'):
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.json
    code = data.get('code', '').strip()
    problem_text = data.get('problem_text', '')
    problem_number = data.get('problem_number', 1)
    
    if not code:
        return jsonify({'success': False, 'message': 'Please write some code before submitting!'})
    
    try:
        # Evaluate code using OpenAI
        evaluation_prompt = f"""Evaluate this Python code solution for the given problem:

PROBLEM: {problem_text}

SUBMITTED CODE:
{code}

Please evaluate:
1. Does it solve the problem correctly?
2. Is the logic sound?
3. Are there any syntax errors?
4. Is it reasonably efficient?

Respond with:
EVALUATION: [PASS/FAIL]
FEEDBACK: [Detailed feedback about the solution]

Be thorough but fair in your evaluation."""
        
        evaluation = call_openai(evaluation_prompt)
        
        # Parse evaluation
        is_passed = 'EVALUATION: PASS' in evaluation
        feedback_parts = evaluation.split('FEEDBACK:')
        feedback = feedback_parts[1].strip() if len(feedback_parts) > 1 else 'Solution evaluated.'
        
        # Update score and store answer
        if is_passed:
            session['score'] = session.get('score', 0) + 1
        
        if 'answers' not in session:
            session['answers'] = []
        
        session['answers'].append({
            'problem': problem_number,
            'code': code,
            'is_passed': is_passed,
            'feedback': feedback
        })
        
        return jsonify({
            'success': True,
            'is_passed': is_passed,
            'feedback': feedback,
            'current_score': session['score']
        })
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error evaluating code: {str(e)}'})

@app.route('/api/end_round', methods=['POST'])
def end_round():
    """End current round and calculate results"""
    if not session.get('current_user'):
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    round_number = session.get('current_round')
    score = session.get('score', 0)
    
    # Store round score
    if 'round_scores' not in session:
        session['round_scores'] = {'round1': None, 'round2': None, 'round3': None}
    
    session['round_scores'][f'round{round_number}'] = score
    
    # Determine if passed - easier criteria for testing
    user_type = session.get('user_type', 'demo')
    
    if user_type == 'admin':
        # Admin always passes
        passed = True
        if score == 0:  # If admin didn't answer anything, set minimum passing score
            score = 7 if round_number != 3 else 2
            session['score'] = score
            session['round_scores'][f'round{round_number}'] = score
    elif DEMO_MODE and user_type == 'demo':
        # Demo mode - easier passing (need only 3/10 for MCQ, 1/2 for coding)
        if round_number == 3:
            passed = score >= 1
        else:
            passed = score >= 3
    else:
        # Normal mode - original criteria
        if round_number == 3:
            passed = score == 2
        else:
            passed = score >= 7
    
    # Generate result message
    if passed:
        if round_number == 1:
            message = f"🎉 **Congratulations!** You scored {score}/10 in Round 1!\n\nYou've successfully passed the screening round. Your analytical and reasoning skills are impressive!\n\n✅ **Ready for Round 2?** Head back to the dashboard to start the technical assessment."
        elif round_number == 2:
            message = f"🎉 **Outstanding!** You scored {score}/10 in Round 2!\n\nYour technical knowledge of Python and AI/ML is solid. You're ready for the final challenge!\n\n✅ **Ready for Round 3?** Return to the dashboard to begin the coding challenge."
        else:  # round 3
            total_scores = session['round_scores']
            message = f"🎊 **CONGRATULATIONS!** 🎊\n\nYou've successfully completed all three rounds of the interview process!\n\n✅ **Your Journey:**\n- Round 1: {total_scores['round1']}/10 (Screening)\n- Round 2: {total_scores['round2']}/10 (Technical)\n- Round 3: {score}/2 Problems Solved (Coding)\n\n🌟 **What's Next?**\nOur team is thoroughly impressed with your performance. You've demonstrated excellent problem-solving skills, technical knowledge, and coding abilities.\n\n📞 **We'll contact you soon** with the next steps in the hiring process!\n\nThank you for your time and effort. Welcome to the team! 🚀\n\n🎯 **Click 'Back to Dashboard' to view your detailed completion report.**"
    else:
        if round_number == 3:
            message = f"Thank you for your effort in the coding round! You solved {score}/2 problems correctly.\n\n💡 **Remember:** Great programmers are made through practice and persistence. Every line of code you write makes you stronger.\n\n🎯 **Areas to focus on:**\n- Algorithm design and implementation\n- Problem decomposition\n- Code optimization\n- Testing and debugging\n\n🔄 **Feel free to retry** when you're ready. I'm here to help you succeed!\n\nYour determination to improve is already a sign of a great developer mindset! 💪"
        else:
            topics = '- Logical reasoning techniques\n- Quantitative problem-solving\n- Pattern recognition skills' if round_number == 1 else '- Python fundamentals\n- AI/ML concepts\n- Programming best practices'
            message = f"Thank you for attempting Round {round_number}! You scored {score}/10.\n\n💪 **Don't give up!** Every great developer has faced challenges. This is just a stepping stone in your journey.\n\n📚 **Consider reviewing:**\n{topics}\n\n🚀 **You can retry this round anytime.** I believe in your potential!"
    
    return jsonify({
        'success': True,
        'passed': passed,
        'score': score,
        'message': message,
        'round_scores': session['round_scores']
    })

@app.route('/api/submit_all_answers', methods=['POST'])
def submit_all_answers():
    """Submit all answers at once after review"""
    if not session.get('current_user'):
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    data = request.json
    round_number = data.get('round_number')
    answers = data.get('answers', [])
    score = data.get('score', 0)
    
    # Store round score
    if 'round_scores' not in session:
        session['round_scores'] = {'round1': None, 'round2': None, 'round3': None}
    
    session['round_scores'][f'round{round_number}'] = score
    
    # Determine if passed - easier criteria for testing  
    user_type = session.get('user_type', 'demo')
    
    if user_type == 'admin':
        # Admin always passes
        passed = True
        if score == 0:  # If admin didn't answer anything, set minimum passing score
            score = 7
            session['score'] = score
            session['round_scores'][f'round{round_number}'] = score
    elif DEMO_MODE and user_type == 'demo':
        # Demo mode - easier passing (need only 3/10)
        passed = score >= 3
    else:
        # Normal mode - original criteria
        passed = score >= 7
    
    # Generate result message
    if passed:
        if round_number == 1:
            message = f"🎉 **Congratulations!** You scored {score}/10 in Round 1!\n\nYou've successfully passed the screening round. Your analytical and reasoning skills are impressive!\n\n✅ **Ready for Round 2?** Head back to the dashboard to start the technical assessment."
        elif round_number == 2:
            message = f"🎉 **Outstanding!** You scored {score}/10 in Round 2!\n\nYour technical knowledge of Python and AI/ML is solid. You're ready for the final challenge!\n\n✅ **Ready for Round 3?** Return to the dashboard to begin the coding challenge."
    else:
        topics = '- Logical reasoning techniques\n- Quantitative problem-solving\n- Pattern recognition skills' if round_number == 1 else '- Python fundamentals\n- AI/ML concepts\n- Programming best practices'
        message = f"Thank you for attempting Round {round_number}! You scored {score}/10.\n\n💪 **Don't give up!** Every great developer has faced challenges. This is just a stepping stone in your journey.\n\n📚 **Consider reviewing:**\n{topics}\n\n🚀 **You can retry this round anytime.** I believe in your potential!"
    
    return jsonify({
        'success': True,
        'passed': passed,
        'score': score,
        'message': message,
        'round_scores': session['round_scores']
    })

@app.route('/api/get_dashboard_status', methods=['GET'])
def get_dashboard_status():
    """Get current dashboard status"""
    if not session.get('current_user'):
        return jsonify({'success': False, 'message': 'Not authenticated'})
    
    return jsonify({
        'success': True,
        'round_scores': session.get('round_scores', {'round1': None, 'round2': None, 'round3': None}),
        'current_user': session.get('current_user')
    })

@app.route('/api/clear_session', methods=['POST'])
def clear_session():
    """Clear all session data - for debugging"""
    session.clear()
    return jsonify({'success': True, 'message': 'Session cleared successfully'})

@app.route('/api/admin_bypass_round', methods=['POST'])
def admin_bypass_round():
    """Admin bypass to directly pass any round"""
    if not session.get('current_user') or session.get('user_type') != 'admin':
        return jsonify({'success': False, 'message': 'Admin access required'})
    
    data = request.json
    round_number = data.get('round_number')
    
    if not round_number or round_number not in [1, 2, 3]:
        return jsonify({'success': False, 'message': 'Invalid round number'})
    
    # Set passing scores for all previous rounds
    if 'round_scores' not in session:
        session['round_scores'] = {'round1': None, 'round2': None, 'round3': None}
    
    for i in range(1, round_number + 1):
        if i == 3:
            session['round_scores'][f'round{i}'] = 2  # Coding round
        else:
            session['round_scores'][f'round{i}'] = 7  # MCQ rounds
    
    return jsonify({
        'success': True, 
        'message': f'Admin bypass: Passed all rounds up to Round {round_number}',
        'round_scores': session['round_scores']
    })

@app.route('/api/check_session', methods=['GET'])
def check_session():
    """Debug endpoint to check session state"""
    return jsonify({
        'current_user': session.get('current_user'),
        'user_type': session.get('user_type'),
        'round_scores': session.get('round_scores'),
        'session_keys': list(session.keys())
    })

def call_openai(prompt):
    """Make API call to OpenAI"""
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert AI interview assistant. Generate high-quality, fair, and challenging interview questions. Be precise and follow the requested format exactly."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        print(f"OpenAI API error: {e}")
        raise e

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
