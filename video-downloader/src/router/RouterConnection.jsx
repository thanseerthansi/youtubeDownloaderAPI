import React from 'react'
import { Outlet } from 'react-router-dom'
import Header from '../layout/Header'

function RouterConnection() {
  return (
    <>
        <Header/>
        <Outlet/>
    </>
  )
}

export default RouterConnection