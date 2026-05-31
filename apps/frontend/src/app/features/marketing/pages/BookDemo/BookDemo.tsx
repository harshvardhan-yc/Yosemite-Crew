'use client';
import React from 'react';
import CalEmbedFrame from '@/app/ui/overlays/CalEmbedFrame';

import './BookDemo.css';

const BookDemo = () => {
  return (
    <div className="App">
      <h1 className="sr-only">Book a demo</h1>
      <CalEmbedFrame
        calLink="yosemitecrew/demo"
        title="Book a demo"
        className="size-full border-0"
      />
    </div>
  );
};

export default BookDemo;
