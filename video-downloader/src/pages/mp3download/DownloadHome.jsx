import React, { useState } from 'react'
import { ApiCall } from '../../service/ApiCall';
import { Baseurl, Url } from '../../constants/Urls';
import axios from 'axios';
// import yt from "ytdl-core";

export default function DownloadHome() {
    const [btnLoad, setBtnLoad] = useState(false);
    const [loading,setLoading] = useState(false);
    const [url, setUrl] = useState("");
    const [data, setData] = useState(null);
    console.log("loading:",loading);
    const onclickurl = async()=>{
        setBtnLoad(true);
        setData(null);
        let info = await ApiCall("get",Url.info,null,{url:url});
        if(info.status){
            setData(info?.message?.items);   
        }
        setBtnLoad(false);
    }
    const onDownload = async (videourl, type) => {
        setLoading(true);
       
    // console.log("Starting native browser download for:", videourl, "with format:", type);
        try {
        const url = Baseurl + Url.download + `?url=${videourl}&type=${type}`;
        // window.open(url,"_blank");
        const link = document.createElement("a");
        link.href = url;
        // don’t set link.download here → let server provide Malayalam title
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setLoading(false);
    ;
  } catch (err) {
    setLoading(false);
    console.error("Download error:", err);
  }
};
  return (
    
    <div className='container'>
        <div className='main-DownloadHome'>
            <h1>Welcome to Youtube Downloader</h1>
            <h3>Download your favourite videos in mp3 and mp4 format</h3>
        </div>
        <div className='search-main'>
            <input className='search-input'  onChange={(e)=>setUrl(e.target.value)}  type="text" placeholder='Enter youtube video link here...' />
            <button className={`download-btn $`} disabled = {btnLoad} onClick={()=>onclickurl()} > { btnLoad? "Loading...":"Search"}</button>

            

        </div>
        <div className='text-info mt-4'>
            <p>Note : This tool only works for youtube video links. Please enter a valid youtube video link.</p>
        </div>
        <div className='table-section   mt-5'>
            {btnLoad ?
            <div class="d-flex justify-content-center">
  <div className="spinner-border" role="status">
  </div>
    <span class="sr-only mt-1">Loading...</span>
</div>
:
            <table className="table scrollable-table" >
                 <thead >
                <tr>
                <th scope="col">#</th>
                <th scope="col">Thumbnail</th>
                <th scope="col">Heading</th>
                <th scope="col">Download</th>
                </tr>
            </thead>
                {data && data.map((item, index)=>(
                    
                    
            <tbody key={index}>
                <tr className='align-middle'>
                <th scope="row">{index+1}</th>
                <td><img src={item?.thumbnail} width={150}/></td>
                <td width={400}>{item?.title}<br/>URL :  {item?.url}</td>
                <td className='table-btns'>
                    <button className='btn btn-primary table-btns' onClick={()=>onDownload(item.url,"mp3")}>{loading?<div className="spinner-border" role="status"></div>:"mp3"}</button>
                    <button className='btn btn-primary table-btns' onClick={()=>onDownload(item.url,"mp4")}>mp4</button>
                </td>
                </tr>

            </tbody>
                ))}
           
            </table>
}
            </div>
    </div>
  )
}
