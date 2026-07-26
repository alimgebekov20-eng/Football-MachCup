class VirtualJoystick {
    constructor(containerId, thumbId, options = {}) {
        this.container = document.getElementById(containerId);
        this.thumb = document.getElementById(thumbId);
        
        this.options = {
            maxDistance: this.container.offsetWidth / 2 - this.thumb.offsetWidth / 2 - 10,
            deadZone: 0.1, // Мертвая зона (10%)
            ...options
        };
        
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.callbacks = [];
        
        this.setupEvents();
        this.resetThumb();
    }
    
    setupEvents() {
        // Touch
        this.container.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleStart(e);
        }, { passive: false });
        
        this.container.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleMove(e);
        }, { passive: false });
        
        this.container.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleEnd(e);
        }, { passive: false });
        
        this.container.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.handleEnd(e);
        }, { passive: false });
        
        // Mouse (для ПК)
        this.container.addEventListener('mousedown', (e) => this.handleStart(e));
        window.addEventListener('mousemove', (e) => this.handleMove(e));
        window.addEventListener('mouseup', (e) => this.handleEnd(e));
    }
    
    getPosition(event) {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let clientX, clientY;
        
        if (event.touches) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        return {
            x: clientX - centerX,
            y: clientY - centerY
        };
    }
    
    handleStart(event) {
        this.active = true;
        const pos = this.getPosition(event);
        this.update(pos.x, pos.y);
    }
    
    handleMove(event) {
        if (!this.active) return;
        const pos = this.getPosition(event);
        this.update(pos.x, pos.y);
    }
    
    handleEnd(event) {
        if (!this.active) return;
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.resetThumb();
        this.triggerCallbacks();
    }
    
    update(dx, dy) {
        const distance = Math.hypot(dx, dy);
        const maxDist = this.options.maxDistance;
        
        if (distance > maxDist) {
            dx = (dx / distance) * maxDist;
            dy = (dy / distance) * maxDist;
        }
        
        // Нормализуем от -1 до 1
        let normX = dx / maxDist;
        let normY = dy / maxDist;
        
        // Dead zone
        const dist = Math.hypot(normX, normY);
        if (dist < this.options.deadZone) {
            normX = 0;
            normY = 0;
        }
        
        this.x = normX;
        this.y = normY;
        
        this.updateThumbPosition(normX, normY);
        this.triggerCallbacks();
    }
    
    updateThumbPosition(x, y) {
        const maxDist = this.options.maxDistance;
        const px = x * maxDist;
        const py = y * maxDist;
        
        const containerWidth = this.container.offsetWidth;
        const containerHeight = this.container.offsetHeight;
        
        this.thumb.style.transform = `translate(${-50 + (px / containerWidth * 100)}%, ${-50 + (py / containerHeight * 100)}%)`;
    }
    
    resetThumb() {
        this.thumb.style.transform = 'translate(-50%, -50%)';
    }
    
    getDirection() {
        return {
            x: this.x,
            y: this.y
        };
    }
    
    isActive() {
        return this.active && (Math.abs(this.x) > 0.01 || Math.abs(this.y) > 0.01);
    }
    
    onMove(callback) {
        this.callbacks.push(callback);
    }
    
    triggerCallbacks() {
        const direction = this.getDirection();
        for (const callback of this.callbacks) {
            callback(direction);
        }
    }
}
