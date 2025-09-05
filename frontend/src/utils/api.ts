/**
 * Safely parses JSON response, handling HTML error pages
 */
export const safeParseJSON = async (response: Response): Promise<any> => {
  const contentType = response.headers.get('content-type');
  
  if (!contentType || !contentType.includes('application/json')) {
    // Response is not JSON, likely HTML error page
    const text = await response.text();
    console.warn('API endpoint returned non-JSON response:', text.substring(0, 100));
    throw new Error('API endpoint returned non-JSON response');
  }
  
  return response.json();
};

/**
 * Makes a safe API request with proper error handling
 */
export const safeApiRequest = async (url: string, options?: RequestInit): Promise<any> => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    return await safeParseJSON(response);
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};