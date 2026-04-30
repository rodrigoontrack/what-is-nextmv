import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

interface Props {
  steps: TourStep[];
  active: boolean;
  onClose: () => void;
}

const TOOLTIP_W = 320;
const TOOLTIP_H = 180;
const GAP = 14;

const TourTooltip = ({ steps, active, onClose }: Props) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const refreshRect = useCallback((index: number) => {
    const el = document.querySelector(steps[index]?.target ?? "");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setRect(el.getBoundingClientRect()), 320);
  }, [steps]);

  useEffect(() => {
    if (!active) { setStep(0); setRect(null); return; }
    refreshRect(step);
  }, [active, step, refreshRect]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => refreshRect(step);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, step, refreshRect]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && step < steps.length - 1) setStep(s => s + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep(s => s - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, step, steps.length, onClose]);

  if (!active || !rect) return null;

  const placement = steps[step].placement ?? "bottom";
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const clampX = (x: number) => Math.max(8, Math.min(x, vw - TOOLTIP_W - 8));
  const clampY = (y: number) => Math.max(8, Math.min(y, vh - TOOLTIP_H - 8));

  let left = 0, top = 0;
  if (placement === "bottom") {
    left = clampX(rect.left + rect.width / 2 - TOOLTIP_W / 2);
    top = clampY(rect.bottom + GAP);
  } else if (placement === "top") {
    left = clampX(rect.left + rect.width / 2 - TOOLTIP_W / 2);
    top = clampY(rect.top - TOOLTIP_H - GAP);
  } else if (placement === "right") {
    left = clampX(rect.right + GAP);
    top = clampY(rect.top + rect.height / 2 - TOOLTIP_H / 2);
  } else {
    left = clampX(rect.left - TOOLTIP_W - GAP);
    top = clampY(rect.top + rect.height / 2 - TOOLTIP_H / 2);
  }

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return createPortal(
    <>
      {/* Spotlight: box-shadow dims everything outside the target */}
      <div
        style={{
          position: "fixed",
          left: rect.left - 6,
          top: rect.top - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.52)",
          borderRadius: 8,
          zIndex: 9998,
          pointerEvents: "none",
          border: "2px solid hsl(221 83% 53%)",
          transition: "left 0.25s,top 0.25s,width 0.25s,height 0.25s",
        }}
      />
      {/* Tooltip card */}
      <div
        style={{ position: "fixed", width: TOOLTIP_W, left, top, zIndex: 9999 }}
        className="rounded-xl border bg-background shadow-2xl p-4"
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold leading-snug">{steps[step].title}</p>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5"
            aria-label="Cerrar tutorial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{steps[step].content}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{step + 1} / {steps.length}</span>
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Anterior
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={onClose}>Finalizar</Button>
            ) : (
              <Button size="sm" onClick={() => setStep(s => s + 1)}>
                Siguiente
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default TourTooltip;
