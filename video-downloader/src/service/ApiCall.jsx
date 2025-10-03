import axios from "axios";
import { Baseurl } from "../constants/Urls";


export const ApiCall = async (method, endPoint, data, params, is_formdata) => {

  var headers = {
    "Content-Type": is_formdata ? "multipart/form-data" : "application/json",
    // Authorization:token? token:'',
    platform: "web",
  };
  console.log("params:", params);
  var url = Baseurl + endPoint;
  console.log("API Call:", url);
  try {
    const res = await axios({
      method,
      url,
      params,
      data,
      headers,
    });
    console.log("Response from API:", res);
    if(res.status !== 200){
        throw new Error('Error in API call');
    }else{
        var response = { status:true, message: res.data };
    }
    

    return response;
  } catch (error) {
    return error;
  }
};
