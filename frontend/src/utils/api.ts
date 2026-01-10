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