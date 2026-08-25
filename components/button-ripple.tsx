"use client";

import { Button } from "@/components/ui/button";
import { useRipple } from "@/lib/hooks/use-ripple";
import { rippleStyles } from "@/lib/hooks/use-ripple";
import React from "react";

interface ButtonRippleProps extends React.ComponentProps<typeof Button> {}

export function ButtonRipple({ onClick, ...props }: ButtonRippleProps) {
  const { addRipple } = useRipple();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    addRipple(e);
    onClick?.(e);
  };

  return (
    <>
      <style>{rippleStyles}</style>
      <Button
        {...props}
        onClick={handleClick}
        data-ripple
        className={`relative overflow-hidden ${props.className}`}
      />
    </>
  );
}
