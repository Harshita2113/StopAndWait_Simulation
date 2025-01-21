class StopAndWaitARQ {
    constructor() {
        this.currentSeqNum = 0;
        this.isWaiting = false;
        this.packetsSent = 0;
        this.successCount = 0;
        this.timeoutCount = 0;
        this.animationSpeed = 1;
        this.tutorialStep = 0;
        this.tutorials = [
            "Welcome! This simulation shows how computers ensure reliable data transfer.",
            "The sender will send one packet at a time and wait for acknowledgment (ACK).",
            "If the packet or ACK is lost, a timer will expire and the packet will be resent.",
            "This simple but effective protocol ensures all data arrives correctly!",
            "Let's start the simulation! Choose a scenario and click 'Start'."
        ];
        this.timeoutDuration = 5000;
        this.isPaused = false;
        this.animationPromises = [];
        this.currentTimer = null;
    }

    initialize() {
        this.updateStats();
        this.setupEventListeners();
        this.showNextTutorial();
        this.updateSequenceNumber();
    }

    setupEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => this.startSimulation());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('speedControl').addEventListener('input', (e) => {
            this.animationSpeed = e.target.value;
            this.timeoutDuration = 5000 / this.animationSpeed;
            document.getElementById('timeoutDuration').textContent = `${this.timeoutDuration}ms`;
        });
        document.getElementById('nextTip').addEventListener('click', () => this.showNextTutorial());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
    }

    showNextTutorial() {
        const tutorialText = document.getElementById('tutorialText');
        const tutorialBox = document.getElementById('tutorialBox');
        const dots = document.querySelectorAll('.dot');
        
        if (this.tutorialStep < this.tutorials.length) {
            // Update active dot
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === this.tutorialStep);
            });
            
            // Animate text change
            tutorialText.style.opacity = '0';
            setTimeout(() => {
                tutorialText.textContent = this.tutorials[this.tutorialStep];
                tutorialText.style.opacity = '1';
            }, 300);
            
            this.tutorialStep++;
        } else {
            tutorialBox.style.transform = 'translateY(20px)';
            tutorialBox.style.opacity = '0';
            setTimeout(() => {
                tutorialBox.style.display = 'none';
            }, 300);
        }
    }

    async startSimulation() {
        const scenario = document.getElementById('scenarioSelect').value;
        const startBtn = document.getElementById('startBtn');
        startBtn.disabled = true;
        
        // Clear previous packets from receiver
        document.getElementById('receiverQueue').innerHTML = '';
        
        for (let i = 0; i < 5; i++) {
            await this.sendPacket(scenario);
            await this.delay(500 / this.animationSpeed);
        }
        
        startBtn.disabled = false;
    }

    async sendPacket(scenario) {
        if (this.isWaiting) return;

        this.isWaiting = true;
        this.packetsSent++;
        this.updateStats();

        // Remove packet from sender queue
        const senderQueue = document.getElementById('senderQueue');
        const firstPacket = senderQueue.firstElementChild;
        if (firstPacket) {
            firstPacket.classList.add('sending');
            await this.delay(200);
            firstPacket.remove();
        }

        const packet = this.createPacketElement(this.currentSeqNum);
        document.getElementById('packetContainer').appendChild(packet);

        this.updateStatus('sender', `Sending packet ${this.currentSeqNum}`);
        
        // Start timer as soon as packet is sent
        this.startTimer();
        
        if (scenario === 'packet-loss') {
            await this.animatePacketLoss(packet);
            await this.handleTimeout();
            await this.retransmitPacket();
        } else {
            await this.animatePacket(packet);
            if (scenario === 'ack-loss') {
                await this.handleAckLoss();
                await this.handleTimeout();
                await this.retransmitPacket();
            } else {
                // In normal case, ACK should be received before timer expires
                await this.handleNormalTransmission();
                // Reset timer on successful ACK
                const timer = document.querySelector('.timer-fill');
                timer.style.width = '0';
            }
        }
    }

    createPacketElement(seqNum) {
        const packet = document.createElement('div');
        packet.className = 'data-packet packet-animation';
        packet.innerHTML = `
            <span class="packet-number">${seqNum}</span>
            <div class="packet-rings"></div>
        `;
        packet.style.left = '0%';
        packet.style.top = '50%';
        
        // Add particle effects
        this.addParticleEffect(packet);
        
        return packet;
    }

    addParticleEffect(element) {
        for (let i = 0; i < 5; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            element.appendChild(particle);
        }
    }

    async animatePacketLoss(packet) {
        return new Promise(async (resolve) => {
            // First animate packet to middle
            packet.style.left = '0%';
            await this.delay(100);
            packet.style.left = '50%';
            await this.delay(1000 / this.animationSpeed);
            
            // Then show loss animation
            packet.classList.add('packet-loss');
            this.updateStatus('receiver', 'Packet lost in transmission!', 'error');
            
            setTimeout(() => {
                packet.remove();
                resolve();
            }, 1000 / this.animationSpeed);
        });
    }

    async animatePacket(packet) {
        return new Promise((resolve) => {
            setTimeout(() => {
                packet.style.left = '100%';
                
                setTimeout(() => {
                    // Add packet to receiver queue
                    const receiverQueue = document.getElementById('receiverQueue');
                    const receivedPacket = this.createPacketElement(this.currentSeqNum);
                    receivedPacket.style.position = 'static';
                    receiverQueue.appendChild(receivedPacket);
                    
                    packet.remove();
                    resolve();
                }, 1000 / this.animationSpeed);
            }, 100);
        });
    }

    async handleTimeout() {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.timeoutCount++;
                this.isWaiting = false;
                this.updateStats();
                this.updateStatus('sender', 'Timeout detected - Initiating retransmission', 'error');
                resolve();
            }, this.timeoutDuration);
        });
    }

    async retransmitPacket() {
        const packet = this.createPacketElement(this.currentSeqNum);
        packet.classList.add('retransmission');
        document.getElementById('packetContainer').appendChild(packet);
        
        this.updateStatus('sender', `Retransmitting packet ${this.currentSeqNum}`);
        // Start timer again for retransmission
        this.startTimer();
        await this.animatePacket(packet);
        await this.handleNormalTransmission();
    }

    async handleAckLoss() {
        const ack = this.createAckElement();
        document.getElementById('packetContainer').appendChild(ack);
        
        return new Promise(async (resolve) => {
            // Start ACK from receiver side
            ack.style.left = '100%';
            await this.delay(100);
            
            // Move to middle
            ack.style.left = '50%';
            await this.delay(1000 / this.animationSpeed);
            
            // Then show loss animation
            ack.classList.add('packet-loss');
            this.updateStatus('sender', 'ACK lost in transmission!', 'error');
            
            setTimeout(() => {
                ack.remove();
                resolve();
            }, 1000 / this.animationSpeed);
        });
    }

    async handleNormalTransmission() {
        const ack = this.createAckElement();
        document.getElementById('packetContainer').appendChild(ack);
        
        await this.animateAck(ack);
        // Reset timer when ACK is received
        const timer = document.querySelector('.timer-fill');
        timer.style.width = '0';
        timer.style.transition = 'none';
        
        this.successCount++;
        this.currentSeqNum++;
        this.isWaiting = false;
        this.updateStats();
        this.updateSequenceNumber();
        this.updateStatus('receiver', 'Packet received successfully!', 'success');
    }

    createAckElement() {
        const ack = document.createElement('div');
        ack.className = 'data-packet packet-animation ack';
        ack.textContent = 'ACK';
        ack.style.left = '100%';
        ack.style.top = '50%';
        return ack;
    }

    async animateAck(ack) {
        return new Promise((resolve) => {
            setTimeout(() => {
                ack.style.left = '0';
                setTimeout(() => {
                    ack.remove();
                    resolve();
                }, 1000 / this.animationSpeed);
            }, 100);
        });
    }

    updateStatus(device, message, type = '') {
        const statusElement = document.getElementById(`${device}Status`);
        const indicator = document.createElement('div');
        indicator.className = `status-indicator ${type ? 'status-' + type : ''} show`;
        indicator.textContent = message;
        
        // Remove any existing indicators
        const existingIndicator = statusElement.querySelector('.status-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        statusElement.textContent = message;
        statusElement.appendChild(indicator);
        
        if (type) {
            setTimeout(() => {
                indicator.remove();
            }, 2000 / this.animationSpeed);
        }
    }

    updateStats() {
        document.getElementById('packetsSent').textContent = this.packetsSent;
        document.getElementById('successCount').textContent = this.successCount;
        document.getElementById('timeoutCount').textContent = this.timeoutCount;
    }

    updateSequenceNumber() {
        document.getElementById('seqNum').textContent = this.currentSeqNum;
    }

    async delay(ms) {
        await new Promise(resolve => setTimeout(resolve, ms));
        if (this.isPaused) {
            await new Promise(resolve => {
                this.animationPromises.push(resolve);
            });
        }
    }

    reset() {
        location.reload();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
        
        if (!this.isPaused) {
            // Resume all paused animations
            this.animationPromises.forEach(resolve => resolve());
            this.animationPromises = [];
        }
    }

    // Add this method to handle timer
    async startTimer() {
        // Clear any existing timer
        if (this.currentTimer) {
            const oldTimer = document.querySelector('.timer-fill');
            oldTimer.style.width = '0';
            oldTimer.style.transition = 'none';
        }

        const timer = document.querySelector('.timer-fill');
        timer.style.width = '0';
        timer.style.transition = 'width 5s linear';
        
        // Force reflow to ensure transition reset
        timer.offsetHeight;
        
        // Start new timer animation
        requestAnimationFrame(() => {
            timer.style.width = '100%';
        });
    }
}

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    const arq = new StopAndWaitARQ();
    arq.initialize();
});