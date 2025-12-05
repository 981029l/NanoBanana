
import React from 'react';
import { MagicWandIcon } from './IconComponents';

const Header: React.FC = () => {
  return (
    <header className="text-center p-4 md:p-8 fade-in relative z-10">
      <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-4">
        <div className="logo-container">
           <MagicWandIcon className="w-7 h-7 md:w-8 md:h-8 text-white relative z-10" />
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold gradient-text tracking-tight">
          Nano Banana Photo Editor
        </h1>
      </div>
      <p className="mt-3 md:mt-4 text-sm sm:text-base md:text-lg text-slate-600 px-4">
        ✨ Transform your images with AI-powered magic
      </p>
    </header>
  );
};

export default Header;
