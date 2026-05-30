import React, { ReactNode } from 'react';
import Link from 'next/link';

type ButtonProps = {
  icon: ReactNode;
  text: string;
  href: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  style?: React.CSSProperties;
};

export const FillBtn = ({ icon, text, onClick, href, style }: Readonly<ButtonProps>) => (
  <Link
    href={href}
    className="Fillbtn"
    onClick={(e) => {
      if (onClick) {
        e.preventDefault();
        onClick(e);
      }
    }}
    style={style}
  >
    {icon} {text}
  </Link>
);

export const UnFillBtn = ({ icon, text, href, onClick, style }: Readonly<ButtonProps>) => (
  <Link className="UnFillbtn" href={href} onClick={onClick} style={style}>
    {icon} {text}
  </Link>
);
