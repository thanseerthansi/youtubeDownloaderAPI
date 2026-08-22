import axios from "axios";
import { Baseurl } from "../constants/Urls";

export const ApiCall = async (method, endPoint, data, params, is_formdata) => {
  var headers = {
    "Content-Type": is_formdata ? "multipart/form-data" : "application/json",
    platform: "web",
  };
  var url = Baseurl + endPoint;
  try {
    const res = await axios({
      method,
      url,
      params,
      data,
      headers,
    });
    if (res.status >= 200 && res.status < 300) {
      return { status: true, message: res.data };
    } else {
      return { status: false, error: res.data?.error || "Error in API call" };
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message || "Network error occurred";
    return { status: false, error: errorMsg };
  }
};

