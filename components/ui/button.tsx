import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:pointer-events-none disabled:opacity-50",
          variant === "default" &&
            "bg-sky-600 text-white hover:bg-sky-700 shadow-sm",
          variant === "outline" &&
            "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
          variant === "ghost" &&
            "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          variant === "destructive" &&
            "bg-rose-600 text-white hover:bg-rose-700",
          size === "sm" && "h-8 px-3 text-sm",
          size === "md" && "h-10 px-4 text-sm",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
