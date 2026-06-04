import React from 'react';

// TopBar receives a pageTitle prop and displays it
// Every page passes its own title so this one component works everywhere
const TopBar = ({ pageTitle }) => {
  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0">
      <h2 className="text-gray-800 font-semibold text-lg">{pageTitle}</h2>
    </div>
  );
};

export default TopBar;