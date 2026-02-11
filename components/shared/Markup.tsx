/**
 * Markup System — Wise Design Foundations
 *
 * Semantic text emphasis components. Use sparingly — only tag 1-2 key words,
 * not entire sentences. Each marker adds color + weight to convey meaning.
 *
 * Components:
 *   <Important>  Primary color, semibold — key information
 *   <Positive>   Success color, semibold — positive values/states
 *   <Negative>   Danger color, semibold  — negative values/warnings
 *   <Strike>     Strikethrough, aria-hidden — old/replaced values
 *   <MarkupLink> Brand color, semibold, underline — inline actions
 *
 * String parser:
 *   <MarkupText text="Tienes <important>3 pendientes</important>" />
 *
 * @example
 *   <p>Estado: <Positive>Aprobado</Positive></p>
 *   <p>Quedan <Important>2 días</Important> para el cierre</p>
 */
'use client';

import React from 'react';

/* ─── Individual emphasis components ─── */

export function Important({ children }: { children: React.ReactNode }) {
  return <strong className="markup-important">{children}</strong>;
}

export function Positive({ children }: { children: React.ReactNode }) {
  return <span className="markup-positive">{children}</span>;
}

export function Negative({ children }: { children: React.ReactNode }) {
  return <span className="markup-negative">{children}</span>;
}

export function Strike({ children }: { children: React.ReactNode }) {
  return <span className="markup-strike" aria-hidden="true">{children}</span>;
}

export function MarkupLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      className="markup-link"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

/* ─── String-based markup parser ─── */

/**
 * Parses a string with simplified markup tags and renders React elements.
 *
 * Supported tags:
 *   <important>text</important>
 *   <positive>text</positive>
 *   <negative>text</negative>
 *   <strikethrough>text</strikethrough>
 *   <link url="...">text</link>
 *
 * @example
 *   <MarkupText text="Hay <important>3</important> solicitudes <positive>aprobadas</positive>" />
 */
export function MarkupText({ text, className }: { text: string; className?: string }) {
  const parts = parseMarkupString(text);
  return <span className={className}>{parts}</span>;
}

function parseMarkupString(text: string): React.ReactNode[] {
  const regex = /<(important|positive|negative|strikethrough|link)(?:\s+url="([^"]*)")?>([^<]*)<\/\1>/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before the tag
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const [, tag, url, content] = match;
    const key = `m-${match.index}`;

    switch (tag) {
      case 'important':
        parts.push(<strong key={key} className="markup-important">{content}</strong>);
        break;
      case 'positive':
        parts.push(<span key={key} className="markup-positive">{content}</span>);
        break;
      case 'negative':
        parts.push(<span key={key} className="markup-negative">{content}</span>);
        break;
      case 'strikethrough':
        parts.push(<span key={key} className="markup-strike" aria-hidden="true">{content}</span>);
        break;
      case 'link':
        parts.push(<a key={key} href={url || '#'} className="markup-link">{content}</a>);
        break;
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

/* ─── Convenience re-export ─── */
const Markup = {
  Important,
  Positive,
  Negative,
  Strike,
  Link: MarkupLink,
  Text: MarkupText,
};

export default Markup;
