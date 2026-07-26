class VirtualJoystick {
    constructor(containerId, thumbId, options = {}) {
        this.container = document.getElementById(containerId);
        this.thumb = document.getElementById(thumbId);
        
        this.options = {
            baseRadius: this.container.offsetWidth / 2,
            thumbRadius: this.thumb.offsetWidth / 2,
            maxDistance: this.container.offsetWidth / 2 - this.thumb.offsetWidth / 2 - 10,
            ...options
        };
        
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.distance = 0;
        this.callbacks = [];
        
        this.setupEvents();
        this.updateThumbPosition();
    }
    
    setupEvents() {
        this.container.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
        this.container.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
        this.container.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });
        this.container.addEventListener('touchcancel', (e) => this.handleEnd(e), { passive: false });
        
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
        event.preventDefault();
        this.active = true;
        const pos = this.getPosition(event);
        this.update(pos.x, pos.y);
    }
    
    handleMove(event) {
        event.preventDefault();
        if (!this.active) return;
        const pos = this.getPosition(event);
        this.update(pos.x, pos.y);
    }
    
    handleEnd(event) {
        event.preventDefault();
        if (!this.active) return;
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.distance = 0;
        this.updateThumbPosition();
        this.triggerCallbacks();
    }
    
    update(dx, dy) {
        const distance = Math.hypot(dx, dy);
        const maxDist = this.options.maxDistance;
        
        if (distance > maxDist) {
            dx = (dx / distance) * maxDist;
            dy = (dy / distance) * maxDist;
        }
        
        this.x = dx / maxDist;
        this.y = dy / maxDist;
        this.distance = Math.min(distance / maxDist, 1);
        this.angle = Math.atan2(dy, dx);
        
        this.updateThumbPosition();
        this.triggerCallbacks();
    }
    
    updateThumbPosition() {
        const maxDist = this.options.maxDistance;
        const x = (this.x * maxDist);
        const y = (this.y * maxDist);
        
        this.thumb.style.transform = `translate(${-50 + (x / this.container.offsetWidth * 100)}%, ${-50 + (y / this.container.offsetHeight * 100)}%)`;
    }
    
    getDirection() {
        if (this.distance < 0.1) {
            return { x: 0, y: 0 };
        }
        return {
            x: this.x,
            y: this.y
        };
    }
    
    getAngle() {
        return this.angle;
    }
    
    isActive() {
        return this.active && this.distance > 0.1;
    }
    
    onMove(callback) {
        this.callbacks.push(callback);
    }
    
    triggerCallbacks() {
        const direction = this.getDirection();
        for (const callback of this.callbacks) {
            callback(direction, this.angle, this.distance);
        }
    }
}
