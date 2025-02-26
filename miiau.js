// Quizizz ATX - Versão para GitHub
(function() {
    // Sinaliza que está rodando
    window.QuizizzATXRunning = true;
    
    // Create control panel UI
    const panel = document.createElement('div');
    panel.id = 'quizizz-atx-panel';
    panel.style = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg, #3a0ca3, #4361ee);
        color: white;
        padding: 10px;
        border-radius: 10px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        z-index: 9999;
        font-family: 'Arial', sans-serif;
        min-width: 200px;
        transition: all 0.3s;
        border: 2px solid #7209b7;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: bold;">Quizizz ATX</h3>
            <div>
                <button id="quizizz-atx-minimize" style="background: none; border: none; color: white; cursor: pointer; font-size: 14px;">_</button>
                <button id="quizizz-atx-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 14px;">✖</button>
            </div>
        </div>
        <div id="quizizz-atx-content">
            <div id="quizizz-atx-status" style="margin-bottom: 8px; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 5px;">Aguardando...</div>
            <div style="display: flex; gap: 8px;">
                <button id="quizizz-atx-start" style="flex: 1; background: #4cc9f0; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-weight: bold;">Iniciar</button>
                <button id="quizizz-atx-stop" style="flex: 1; background: #f72585; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-weight: bold;" disabled>Parar</button>
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.7);" id="quizizz-atx-info">
                Respostas: 0 | Código: -
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Make panel draggable
    let isDragging = false;
    let offsetX, offsetY;
    
    panel.addEventListener('mousedown', function(e) {
        if (e.target.tagName !== 'BUTTON') {
            isDragging = true;
            offsetX = e.clientX - panel.getBoundingClientRect().left;
            offsetY = e.clientY - panel.getBoundingClientRect().top;
        }
    });
    
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            panel.style.left = (e.clientX - offsetX) + 'px';
            panel.style.top = (e.clientY - offsetY) + 'px';
            panel.style.right = 'auto';
        }
    });
    
    document.addEventListener('mouseup', function() {
        isDragging = false;
    });
    
    // Minimizing functionality
    const content = document.getElementById('quizizz-atx-content');
    const minimizeBtn = document.getElementById('quizizz-atx-minimize');
    let minimized = false;
    
    minimizeBtn.addEventListener('click', function() {
        minimized = !minimized;
        content.style.display = minimized ? 'none' : 'block';
        minimizeBtn.textContent = minimized ? '□' : '_';
        panel.style.width = minimized ? 'auto' : '';
    });
    
    // Close functionality
    document.getElementById('quizizz-atx-close').addEventListener('click', function() {
        stopScript();
        panel.remove();
        window.QuizizzATXRunning = false;
    });
    
    // Initialize variables
    const API_URL = "https://quizzizapi.squareweb.app/quizizz-answers";
    let interval;
    let answersData = [];
    let roomCode;
    const statusEl = document.getElementById('quizizz-atx-status');
    const infoEl = document.getElementById('quizizz-atx-info');
    const startBtn = document.getElementById('quizizz-atx-start');
    const stopBtn = document.getElementById('quizizz-atx-stop');
    
    // Main functions
    function extractRoomCode() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('rc')) return urlParams.get('rc').replace(/\s+/g, '').trim(); 

        const roomCodeElement = document.querySelector('[class*="room-code"]');
        if (roomCodeElement) return roomCodeElement.textContent.replace(/\s+/g, '').trim(); 

        const codeButton = Array.from(document.querySelectorAll('button')).find(
            btn => btn.textContent && /^\d{6}$/.test(btn.textContent.replace(/\s+/g, ''))
        );
        if (codeButton) return codeButton.textContent.replace(/\s+/g, '').trim();

        updateStatus("⚠️ Código da sala não encontrado!", "error");
        return null;
    }

    async function fetchAnswers(roomCode) {
        try {
            updateStatus(`🔄 Buscando respostas para o código: ${roomCode}`, "loading");
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: roomCode }) 
            });

            if (!response.ok) throw new Error(`Erro na API: ${response.status}`);

            const data = await response.json();
            updateStatus("✅ Respostas carregadas!", "success");
            return data.correctAnswers || [];
        } catch (error) {
            updateStatus(`❌ Erro na API: ${error.message}`, "error");
            return [];
        }
    }

    function getCurrentQuestionText() {
        const questionContainer = document.querySelector('[id="questionText"]');
        if (questionContainer) {
            return questionContainer.textContent.trim();
        }
        return null;
    }

    function processCurrentQuestion() {
        const questionText = getCurrentQuestionText();
        if (!questionText) {
            updateStatus("⚠️ Aguardando pergunta...", "warning");
            return;
        }

        updateStatus(`📝 Analisando: "${questionText.substring(0, 30)}..."`, "processing");
        
        const match = answersData.find(item => 
            strip(item.question) === strip(questionText) || 
            strip(questionText).includes(strip(item.question))
        );

        if (match) {
            updateStatus(`✅ Resposta: "${strip(match.answer).substring(0, 30)}..."`, "found");
            clickCorrectAnswer(strip(match.answer));
        } else {
            updateStatus(`❓ Pergunta não encontrada no banco`, "notfound");
        }
    }

    function strip(html) {
        return html.replace(/<\/?[^>]+(>|$)/g, "").trim().replace(/\s+/g, ' ');
    }

    function clickCorrectAnswer(correctAnswer) {
        const options = document.querySelectorAll('.option');
        
        for (const option of options) {
            const optionText = option.textContent.trim();
            
            if (
                optionText === correctAnswer || 
                optionText.includes(correctAnswer) || 
                correctAnswer.includes(optionText)
            ) {
                option.click();
                return;
            }
        }
        
        updateStatus(`⚠️ Resposta não corresponde às opções`, "warning");
    }
    
    function updateStatus(message, type) {
        statusEl.textContent = message;
        
        // Update status styling based on type
        statusEl.style.background = {
            'error': 'rgba(255,0,0,0.2)',
            'success': 'rgba(0,255,0,0.2)',
            'loading': 'rgba(0,0,255,0.2)',
            'warning': 'rgba(255,255,0,0.2)',
            'processing': 'rgba(255,165,0,0.2)',
            'found': 'rgba(0,255,0,0.2)',
            'notfound': 'rgba(128,0,128,0.2)'
        }[type] || 'rgba(255,255,255,0.1)';
    }
    
    function updateInfo() {
        infoEl.textContent = `Respostas: ${answersData.length} | Código: ${roomCode || '-'}`;
    }
    
    // Start/Stop logic
    async function startScript() {
        roomCode = extractRoomCode();
        if (!roomCode) {
            updateStatus("❌ Código da sala não encontrado!", "error");
            return;
        }
        
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        answersData = await fetchAnswers(roomCode);
        updateInfo();
        
        if (answersData.length === 0) {
            updateStatus("⚠️ Nenhuma resposta encontrada!", "warning");
            return;
        }
        
        updateStatus(`✅ ${answersData.length} respostas carregadas!`, "success");
        
        // Initial process and start interval
        processCurrentQuestion();
        interval = setInterval(processCurrentQuestion, 2000);
    }
    
    function stopScript() {
        if (interval) {
            clearInterval(interval);
            interval = null;
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
        updateStatus("⏹️ Script parado", "warning");
    }
    
    // Add event listeners to buttons
    startBtn.addEventListener('click', startScript);
    stopBtn.addEventListener('click', stopScript);
})();
