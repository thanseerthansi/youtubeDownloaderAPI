import './App.css'
import { Route, Routes } from 'react-router-dom'
import PrivateRoute from './router/PrivateRouter'
import RouterConnection from './router/RouterConnection'
import { PATH } from './constants/Path'
import DownloadHome from './pages/mp3download/DownloadHome'

function App() {
  return (
    <>
    <Routes>
      <Route path={PATH.HOME} element={<PrivateRoute><RouterConnection/></PrivateRoute>}>
        <Route index element = {<DownloadHome/>} />
      </Route>
    </Routes>   
    </>
  )
}

export default App
