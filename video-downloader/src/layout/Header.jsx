import React from 'react'

export default function Header() {
  return (
    <header className='main-Header'>
      <div className='header-container'>
        <div className='logo-group'>
          <div className='logo-icon'>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="url(#logo-grad)"/>
              <defs>
                <linearGradient id="logo-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366F1"/>
                  <stop offset="0.5" stopColor="#A855F7"/>
                  <stop offset="1" stopColor="#EC4899"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className='brand-name'>Stream<span className='highlight'>Forge</span></span>
        </div>
        <div className='header-tag'>v2.0 Premium</div>
      </div>
    </header>
  )
}

