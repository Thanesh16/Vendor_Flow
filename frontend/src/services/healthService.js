import api from './api';

/**
 * Health service to check backend API operational status
 */
export const checkApiHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};
