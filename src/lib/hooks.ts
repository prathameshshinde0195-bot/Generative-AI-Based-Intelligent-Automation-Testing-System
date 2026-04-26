import { useAppStore } from './store';
import { useState, useCallback } from 'react';
import { aiAPI } from './api';

export const useAuth = () => {
  const store = useAppStore();
  const [isLoading] = useState(false);

  const logout = useCallback(() => {
    store.setUser(null);
    store.setToken(null);
    store.setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, [store]);

  return { ...store, logout, isLoading };
};

export const useAIOperations = () => {
  const store = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateTestCases = useCallback(async (requirementText: string) => {
    try {
      setIsLoading(true);
      setError(null);
      store.setIsProcessing(true);
      
      const response = await aiAPI.generateTestCases({
        requirementText,
        projectId: store.projectId,
      });
      
      if (response?.data) {
        store.addTestCases(response.data as any);
      }
      
      return response;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to generate test cases';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
      store.setIsProcessing(false);
    }
  }, [store]);

  const detectAmbiguities = useCallback(async (requirementText: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await aiAPI.detectAmbiguities({ requirementText });
      
      if (response?.data) {
        store.setAmbiguities(response.data as any);
      }
      
      return response;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to detect ambiguities';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  const generateAutomationScript = useCallback(async (testCaseId: string, framework: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await aiAPI.generateAutomationScript({
        testCaseId,
        framework,
      });
      
      return response;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to generate script';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    generateTestCases,
    detectAmbiguities,
    generateAutomationScript,
    isLoading,
    error,
  };
};

export const useExport = () => {
  const downloadFile = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const exportAsJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadFile(blob, `${filename}.json`);
  };

  const exportAsCSV = (data: any[], filename: string) => {
    const headers = Object.keys(data[0] || {});
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h])).join(',')),
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadFile(blob, `${filename}.csv`);
  };

  return { exportAsJSON, exportAsCSV, downloadFile };
};
