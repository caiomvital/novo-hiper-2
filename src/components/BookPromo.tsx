import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';

export const BOOK_URL = 'https://www.amazon.com/dp/B0HNV8DGCZ';

interface BookPromoProps {
  className?: string;
}

/** Cartão com a capa (em paisagem) do livrinho "As Aventuras de Bernardo na Loja de Plantas". */
export const BookPromo: React.FC<BookPromoProps> = ({ className = '' }) => (
  <a
    id="book-promo-link"
    href={BOOK_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={`group block overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${className}`}
    aria-label="Ver o livro As Aventuras de Bernardo na Loja de Plantas na Amazon (abre em nova aba)"
  >
    <picture>
      <source srcSet="/assets/livro/capa-paisagem.webp" type="image/webp" />
      <img
        src="/assets/livro/capa-paisagem.jpg"
        alt="Capa do livro de colorir Novo Hiper: As Aventuras de Bernardo na Loja de Plantas"
        width={1092}
        height={918}
        loading="lazy"
        className="w-full h-auto block"
      />
    </picture>
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        <BookOpen className="w-4 h-4 text-emerald-700 flex-shrink-0" />
        <span className="text-sm font-display font-bold text-stone-900 truncate">
          O livrinho do Bernardo
        </span>
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 group-hover:text-emerald-950 whitespace-nowrap">
        Ver na Amazon
        <ExternalLink className="w-3.5 h-3.5" />
      </span>
    </div>
  </a>
);
