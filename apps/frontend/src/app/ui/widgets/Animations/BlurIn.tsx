'use client';
import { LazyMotion, domAnimation, m, useInView } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

export const BlurIn = ({ children }: { children: ReactNode }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  return (
    <LazyMotion features={domAnimation}>
      <m.h2
        ref={ref}
        initial={{ filter: 'blur(8px)', opacity: 0 }}
        animate={isInView ? { filter: 'blur(0px)', opacity: 1 } : {}}
        transition={{ duration: 1.2 }}
        className="font-satoshi text-xl text-center sm:text-4xl font-bold tracking-[-0.02em] md:text-6xl md:leading-16"
      >
        {children}
      </m.h2>
    </LazyMotion>
  );
};
