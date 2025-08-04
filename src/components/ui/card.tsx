import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva(
  "rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-border bg-card",
        elevated: "shadow-lg shadow-blue-500/10 border-blue-200/20 bg-gradient-to-br from-white to-blue-25/30 dark:bg-gradient-to-br dark:from-slate-800/90 dark:to-slate-700/90 dark:border-white/10 dark:shadow-[0_10px_15px_-3px_hsla(262,83%,58%,0.15)] dark:shadow-[inset_0_1px_0_0_hsla(220,13%,25%,0.8)]",
        premium: "shadow-xl shadow-purple-500/20 border-purple-200/30 bg-gradient-to-br from-white to-purple-25/30 dark:bg-gradient-to-br dark:from-purple-900/40 dark:via-slate-800/80 dark:to-blue-900/40 dark:border-purple-400/20 dark:shadow-[0_20px_25px_-5px_hsla(262,83%,58%,0.25)] dark:shadow-[inset_0_1px_0_0_hsla(262,50%,30%,0.8)]",
        glow: "shadow-2xl shadow-blue-500/25 border-0 bg-gradient-to-br from-white via-blue-25/50 to-purple-25/50 dark:bg-gradient-to-br dark:from-blue-900/30 dark:via-slate-800/80 dark:to-purple-900/30 dark:border-blue-400/20 dark:shadow-[0_25px_50px_-12px_hsla(217,91%,60%,0.3)] dark:shadow-[0_0_0_1px_hsla(217,70%,50%,0.2)] dark:shadow-[inset_0_1px_0_0_hsla(217,70%,25%,0.8)]",
        glass: "backdrop-blur-sm bg-white/60 border-white/20 shadow-xl dark:bg-slate-800/60 dark:border-white/10 dark:backdrop-blur-sm",
        mesh: "bg-gradient-mesh border-0 shadow-xl dark:bg-gradient-to-br dark:from-purple-900/20 dark:via-slate-900/60 dark:to-blue-900/20",
        luxury: "bg-gradient-to-br from-slate-50 via-white to-slate-50 border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:bg-gradient-to-br dark:from-slate-800/95 dark:via-slate-700/95 dark:to-slate-800/95 dark:border-slate-600/30 dark:shadow-[0_8px_30px_rgba(139,92,246,0.15)] dark:shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)]",
        neo: "bg-gradient-to-br from-slate-100 to-white border-slate-300/60 shadow-[8px_8px_16px_#d1d5db,-8px_-8px_16px_#ffffff] dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 dark:border-slate-600/40 dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(100,116,139,0.1)]",
      },
      hover: {
        none: "",
        lift: "hover:shadow-xl hover:-translate-y-1 dark:hover:shadow-[0_20px_25px_-5px_hsla(262,83%,58%,0.25)]",
        glow: "hover:shadow-2xl hover:shadow-purple-500/30 dark:hover:shadow-[0_25px_50px_-12px_hsla(262,83%,58%,0.4)]",
        scale: "hover:scale-105",
        float: "hover:-translate-y-2 hover:shadow-2xl dark:hover:shadow-[0_25px_50px_-12px_hsla(217,91%,60%,0.25)]",
      },
    },
    defaultVariants: {
      variant: "default",
      hover: "none",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, hover, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, hover, className }))}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-2 p-6 pb-4", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-tight tracking-tight text-card-foreground",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-2", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-4 border-t border-border/50", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants }
