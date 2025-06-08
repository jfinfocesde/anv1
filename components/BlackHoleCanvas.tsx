
import React, { useRef, useEffect } from 'react';

interface BlackHoleCanvasProps {
  distanceToBlackHole: number; // Current distance in KM
  timeDilationFactor: number;
  maxSimulatedDistanceKm: number; // Max possible simulated distance in KM
  minSimulatedDistanceKm: number; // Min possible simulated distance in KM
  spaceshipSpeed: number; // For trail effect
  isApproaching: boolean; // For trail effect
  showHorizonFlash: boolean; // New prop for triggering the flash
}

export const BlackHoleCanvas: React.FC<BlackHoleCanvasProps> = ({ 
  distanceToBlackHole, 
  timeDilationFactor,
  maxSimulatedDistanceKm,
  minSimulatedDistanceKm,
  spaceshipSpeed,
  isApproaching,
  showHorizonFlash 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null); 
  const starsRef = useRef<{ x: number; y: number; radius: number; alpha: number, originalX: number, originalY: number }[]>([]);
  const pulseOffsetRef = useRef(0);
  const shipTrailRef = useRef<{ x: number; y: number; opacity: number; size: number }[]>([]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const lastWidthStr = canvasRef.current?.dataset.lastWidth;
    const lastHeightStr = canvasRef.current?.dataset.lastHeight;
    const lastWidth = lastWidthStr ? parseFloat(lastWidthStr) : 0;
    const lastHeight = lastHeightStr ? parseFloat(lastHeightStr) : 0;

    if (starsRef.current.length === 0 || canvas.width !== lastWidth || canvas.height !== lastHeight) {
        const { width, height } = canvas.getBoundingClientRect(); 
        starsRef.current = [];
        const numStars = 250;
        for (let i = 0; i < numStars; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            starsRef.current.push({
                x: x,
                y: y,
                originalX: x,
                originalY: y,
                radius: Math.random() * 1.8 + 0.5,
                alpha: Math.random() * 0.6 + 0.4,
            });
        }
        if(canvasRef.current) {
            canvasRef.current.dataset.lastWidth = String(width);
            canvasRef.current.dataset.lastHeight = String(height);
        }
    }

    const draw = (currentTime: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = currentTime;
        animationFrameIdRef.current = requestAnimationFrame(draw);
        return;
      }

      const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000; 
      lastFrameTimeRef.current = currentTime;
      pulseOffsetRef.current += deltaTime * 5; 


      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        starsRef.current = []; 
         if(canvasRef.current) {
            canvasRef.current.dataset.lastWidth = String(width);
            canvasRef.current.dataset.lastHeight = String(height);
        }
        const numStars = 250;
        for (let i = 0; i < numStars; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            starsRef.current.push({
                x: x,
                y: y,
                originalX: x,
                originalY: y,
                radius: Math.random() * 1.8 + 0.5,
                alpha: Math.random() * 0.6 + 0.4,
            });
        }
      }
      
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#000011';
      ctx.fillRect(0, 0, width, height);

      const bhCenterX = width / 2;
      const bhCenterY = height / 2;
      
      const distortionStrength = Math.min(0.2, (timeDilationFactor - 1) / 5000); 

      starsRef.current.forEach(star => {
        let displayX = star.originalX;
        let displayY = star.originalY;

        if (timeDilationFactor > 5) { 
            const dxToCenter = star.originalX - bhCenterX;
            const dyToCenter = star.originalY - bhCenterY;
            const pullFactor = distortionStrength * (Math.abs(dxToCenter) / width + Math.abs(dyToCenter) / height);
            displayX += dxToCenter * pullFactor;
            displayY += dyToCenter * pullFactor;
            if (Math.sqrt(dxToCenter*dxToCenter + dyToCenter*dyToCenter) > width / 4) {
                 displayX -= (dxToCenter * 0.0001 * Math.min(timeDilationFactor, 200));
                 displayY -= (dyToCenter * 0.0001 * Math.min(timeDilationFactor, 200));
            }
        }
        star.x = displayX; 
        star.y = displayY;

        ctx.beginPath();
        ctx.arc(displayX, displayY, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.fill();
      });

      const baseRadiusFactor = Math.min(width, height) / 7; 
      let normalizedVisualDistance = (distanceToBlackHole - minSimulatedDistanceKm) / Math.max(1, maxSimulatedDistanceKm - minSimulatedDistanceKm);
      normalizedVisualDistance = Math.max(0, Math.min(1, normalizedVisualDistance));

      const minVisualRadiusFactor = 0.08; 
      const schwarzschildRadius = baseRadiusFactor * (minVisualRadiusFactor + (1 - normalizedVisualDistance) * (1 - minVisualRadiusFactor));
      
      const diskOuterRadius = schwarzschildRadius * 2.8; 
      const diskInnerRadius = schwarzschildRadius * 1.1; 
      
      const diskOpacityFactor = Math.min(1, Math.max(0, (1 - normalizedVisualDistance) * 2.5)); 
      const pulseBrightness = (Math.sin(pulseOffsetRef.current) * 0.1 + 0.95) * diskOpacityFactor;

      const diskGradient = ctx.createRadialGradient(bhCenterX, bhCenterY, diskInnerRadius, bhCenterX, bhCenterY, diskOuterRadius);
      diskGradient.addColorStop(0, `rgba(255, 185, 50, ${0.3 * pulseBrightness + 0.7 * pulseBrightness * pulseBrightness})`);
      diskGradient.addColorStop(0.5, `rgba(255, 100, 0, ${0.15 * pulseBrightness + 0.5 * pulseBrightness * pulseBrightness})`);
      diskGradient.addColorStop(1, `rgba(200, 0, 0, ${0.05 * pulseBrightness + 0.2 * pulseBrightness * pulseBrightness})`);

      ctx.beginPath();
      ctx.arc(bhCenterX, bhCenterY, diskOuterRadius, 0, Math.PI * 2);
      ctx.fillStyle = diskGradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(bhCenterX, bhCenterY, schwarzschildRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'black';
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(bhCenterX, bhCenterY, schwarzschildRadius * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(220, 220, 255, ${0.15 * diskOpacityFactor + 0.4 * diskOpacityFactor * diskOpacityFactor})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      const shipSize = Math.min(width, height) / 35;
      const startX = shipSize * 2.5; 
      const endX = bhCenterX - diskOuterRadius - shipSize * 2; 

      const progressTowardsBH = 1.0 - normalizedVisualDistance; 
      const easedProgress = Math.pow(progressTowardsBH, 2.2); 
      const shipX = startX * (1.0 - easedProgress) + endX * easedProgress;
      
      const bobbingAmplitude = shipSize * 0.15;
      const bobbingFrequency = 0.7;
      const shipVerticalBob = Math.sin(pulseOffsetRef.current * bobbingFrequency) * bobbingAmplitude;
      const shipY = height / 2 + shipVerticalBob;
      
      const trailSpeedThreshold = maxSimulatedDistanceKm * 0.001; 
      const normalizedSpeed = Math.min(1, spaceshipSpeed / (maxSimulatedDistanceKm * 0.1));

      if (isApproaching && spaceshipSpeed > trailSpeedThreshold) {
        shipTrailRef.current.push({ 
            x: shipX - shipSize * 0.6, 
            y: shipY, 
            opacity: 0.8 + normalizedSpeed * 0.2, 
            size: shipSize * (0.6 + normalizedSpeed * 0.4)
        });
      }
      
      ctx.save();
      shipTrailRef.current.forEach((p, index) => {
        p.opacity -= 0.06; 
        p.size *= 0.96; 
        if (p.opacity > 0 && p.size > 1) {
          ctx.globalAlpha = p.opacity;
          ctx.beginPath();
          ctx.moveTo(p.x + p.size * 0.5, p.y); 
          ctx.lineTo(p.x - p.size * 1.5, p.y - p.size * 0.3);
          ctx.lineTo(p.x - p.size * 1.5, p.y + p.size * 0.3);
          ctx.closePath();
          const trailPulse = (Math.sin(pulseOffsetRef.current * 2 + index * 0.5) + 1) / 2;
          ctx.fillStyle = `rgba(0, ${155 + trailPulse * 100}, ${100 + trailPulse * 100}, ${p.opacity * 0.5})`;
          ctx.fill();
        }
      });
      shipTrailRef.current = shipTrailRef.current.filter(p => p.opacity > 0 && p.size > 1);
      if (shipTrailRef.current.length > 20) { 
          shipTrailRef.current.shift();
      }
      ctx.restore();


      ctx.save();
      ctx.translate(shipX, shipY);
      
      const shakeIntensityBase = (timeDilationFactor -1) / 400; 
      const shakeIntensity = Math.min(10, shakeIntensityBase); 
      if (timeDilationFactor > 1.2) { 
        const shakeX = (Math.random() - 0.5) * shakeIntensity;
        const shakeY = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(shakeX, shakeY);
      }

      if (isApproaching && spaceshipSpeed > trailSpeedThreshold) {
        const flareLength = shipSize * (1.0 + normalizedSpeed * 2.5) * (1.0 + (1.0-normalizedVisualDistance) * 1.5);
        const flareWidth = shipSize * (0.4 + normalizedSpeed * 0.3);
        const flarePulse = (Math.sin(pulseOffsetRef.current * 3) + 1) / 2; 

        ctx.beginPath();
        ctx.moveTo(-shipSize / 2, 0); 
        ctx.lineTo(-shipSize / 2 - flareLength, -flareWidth / 2 + flarePulse * flareWidth * 0.2);
        ctx.lineTo(-shipSize / 2 - flareLength, flareWidth / 2 - flarePulse * flareWidth * 0.2);
        ctx.closePath();
        
        const flareGradient = ctx.createLinearGradient(
            -shipSize / 2, 0, 
            -shipSize / 2 - flareLength, 0
        );
        flareGradient.addColorStop(0, `rgba(180, 255, 255, 0.9 + flarePulse * 0.1)`);
        flareGradient.addColorStop(0.3, `rgba(100, 200, 255, 0.7 + flarePulse * 0.2)`);
        flareGradient.addColorStop(1, `rgba(50, 150, 255, 0)`);

        ctx.fillStyle = flareGradient;
        ctx.fill();
      }
      
      ctx.beginPath();
      ctx.moveTo(shipSize, 0); 
      ctx.lineTo(-shipSize / 2, -shipSize / 2);
      ctx.lineTo(-shipSize / 2, shipSize / 2);
      ctx.closePath();
      ctx.fillStyle = '#0ff'; 
      ctx.fill();

      if (timeDilationFactor > 500) {
        const auraPulse = (Math.sin(pulseOffsetRef.current * 1.5) + 1) / 2; 
        const auraRadius = shipSize * (1.2 + auraPulse * 0.5);
        const auraOpacity = Math.min(0.7, (timeDilationFactor - 500) / 10000) * (0.5 + auraPulse * 0.5);
        ctx.beginPath();
        ctx.arc(0,0, auraRadius, 0, Math.PI * 2);
        const auraGradient = ctx.createRadialGradient(0,0, shipSize * 0.5, 0,0, auraRadius);
        auraGradient.addColorStop(0, `rgba(255, 0, 0, ${auraOpacity * 0.8})`);
        auraGradient.addColorStop(0.7, `rgba(255, 100, 0, ${auraOpacity * 0.4})`);
        auraGradient.addColorStop(1, `rgba(255, 255, 0, ${auraOpacity * 0.1})`);
        ctx.fillStyle = auraGradient;
        ctx.fill();
      }

      ctx.strokeStyle = '#ccffff'; 
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      starsRef.current.forEach(star => {
        const dx = star.x - bhCenterX; 
        const dy = star.y - bhCenterY;
        const distToBh = Math.sqrt(dx * dx + dy * dy);

        if (distToBh < diskOuterRadius * 3.5 && distToBh > schwarzschildRadius * 0.3) {
          const angle = Math.atan2(dy, dx);
          const bendFactor = (diskOuterRadius / Math.max(1, distToBh)) * 0.20 * diskOpacityFactor * (1 + Math.min(1, timeDilationFactor/5000)); 
          const warpedX = star.x - dx * bendFactor * (diskOuterRadius / Math.max(1, distToBh));
          const warpedY = star.y - dy * bendFactor * (diskOuterRadius / Math.max(1, distToBh));
          ctx.beginPath();
          ctx.moveTo(star.x, star.y);
          ctx.quadraticCurveTo(
            (star.x + warpedX)/2 + (Math.random()-0.5)*15*diskOpacityFactor, 
            (star.y + warpedY)/2 + (Math.random()-0.5)*15*diskOpacityFactor, 
            warpedX, warpedY
          );
          ctx.strokeStyle = `rgba(255, 255, 255, ${star.alpha * 0.6 * (0.4 + 0.6 * diskOpacityFactor)})`;
          ctx.lineWidth = star.radius * (0.6 + 0.8 * diskOpacityFactor); 
          ctx.stroke();
        }
      });
      
      if (showHorizonFlash) {
        ctx.fillStyle = 'rgba(180, 0, 255, 0.4)'; 
        ctx.fillRect(0, 0, width, height);
      }

      animationFrameIdRef.current = requestAnimationFrame(draw);
    };

    lastFrameTimeRef.current = null; 
    animationFrameIdRef.current = requestAnimationFrame(draw);
    
    const resizeObserver = new ResizeObserver(() => {
        const newWidth = canvas.clientWidth;
        const newHeight = canvas.clientHeight;
        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
            starsRef.current = []; 
            if(canvasRef.current) {
                canvasRef.current.dataset.lastWidth = String(newWidth);
                canvasRef.current.dataset.lastHeight = String(newHeight);
            }
        }
    });
    resizeObserver.observe(canvas);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      resizeObserver.disconnect();
      lastFrameTimeRef.current = null;
    };
  }, [distanceToBlackHole, timeDilationFactor, maxSimulatedDistanceKm, minSimulatedDistanceKm, spaceshipSpeed, isApproaching, showHorizonFlash]); 

  return (
    <canvas ref={canvasRef} className="w-full h-full block z-0" />
  );
};
