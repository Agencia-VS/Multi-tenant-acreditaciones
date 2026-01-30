"use client";

import { useTenantColors } from "../tenant/TenantContext";

interface FormSectionProps {
  stepNumber: number;
  title: string;
  children: React.ReactNode;
  description?: string;
}

export default function FormSection({
  stepNumber,
  title,
  children,
  description,
}: FormSectionProps) {
  const colors = useTenantColors();

  return (
    <div 
      className="p-6 rounded-lg border-2 transition-colors"
      style={{ 
        background: `linear-gradient(to right, ${colors.primario}0D, ${colors.dark}0D)`,
        borderColor: `${colors.primario}33`
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = `${colors.primario}66`}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = `${colors.primario}33`}
    >
      <h2 className="text-2xl font-bold mb-2 flex items-center gap-3" style={{ color: colors.primario }}>
        <span 
          className="text-white px-3 py-1 rounded-full text-base font-bold w-8 h-8 flex items-center justify-center"
          style={{ backgroundColor: colors.primario }}
        >
          {stepNumber}
        </span>
        {title}
      </h2>
      {description && (
        <p className="text-base text-gray-600 mb-4 ml-11">{description}</p>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
