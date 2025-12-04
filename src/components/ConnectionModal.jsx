/**
 * Connection Modal - Configure Snowflake connection through the UI
 */

import React, { useState, useEffect } from 'react';
import { X, Database, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function ConnectionModal({ isOpen, onClose, onConnect, currentStatus }) {
  const [formData, setFormData] = useState({
    account: '',
    user: '',
    password: '',
    warehouse: 'COMPUTE_WH',
    database: 'ATLAN_MDLH',
    schema: 'PUBLIC',
    role: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveToStorage, setSaveToStorage] = useState(true);

  // Load saved credentials on mount
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('snowflake_config');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormData(prev => ({ ...prev, ...parsed, password: '' }));
        } catch (e) {
          console.error('Failed to load saved config');
        }
      }
    }
  }, [isOpen]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch('http://localhost:8000/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: formData.account,
          user: formData.user,
          password: formData.password,
          warehouse: formData.warehouse,
          database: formData.database,
          schema: formData.schema,
          role: formData.role || undefined
        })
      });
      
      const result = await response.json();
      setTestResult(result);
      
      if (result.connected && saveToStorage) {
        // Save config (without password) to localStorage
        const { password, ...configToSave } = formData;
        localStorage.setItem('snowflake_config', JSON.stringify(configToSave));
      }
      
      if (result.connected) {
        onConnect?.(result);
      }
    } catch (err) {
      setTestResult({ connected: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleTestConnection();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#3366FF] p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Connect to Snowflake</h2>
                <p className="text-blue-100 text-sm">Enter your credentials to query MDLH</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Identifier *
            </label>
            <input
              type="text"
              value={formData.account}
              onChange={(e) => handleChange('account', e.target.value)}
              placeholder="abc12345.us-east-1"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <Info size={12} />
              Found in your Snowflake URL or Admin → Accounts
            </p>
          </div>

          {/* User & Password */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                value={formData.user}
                onChange={(e) => handleChange('user', e.target.value)}
                placeholder="your_username"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {/* Warehouse & Database */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse *
              </label>
              <input
                type="text"
                value={formData.warehouse}
                onChange={(e) => handleChange('warehouse', e.target.value)}
                placeholder="COMPUTE_WH"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Database
              </label>
              <input
                type="text"
                value={formData.database}
                onChange={(e) => handleChange('database', e.target.value)}
                placeholder="ATLAN_MDLH"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Schema & Role */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schema
              </label>
              <input
                type="text"
                value={formData.schema}
                onChange={(e) => handleChange('schema', e.target.value)}
                placeholder="PUBLIC"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                placeholder="ACCOUNTADMIN"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3366FF] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Remember settings */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveToStorage}
              onChange={(e) => setSaveToStorage(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#3366FF] focus:ring-[#3366FF]"
            />
            <span className="text-sm text-gray-600">Remember connection settings (password not saved)</span>
          </label>

          {/* Test Result */}
          {testResult && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              testResult.connected 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {testResult.connected ? (
                <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
              ) : (
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              )}
              <div>
                <p className={`font-medium ${testResult.connected ? 'text-green-700' : 'text-red-700'}`}>
                  {testResult.connected ? 'Connected successfully!' : 'Connection failed'}
                </p>
                {testResult.connected ? (
                  <p className="text-green-600 text-sm mt-1">
                    {testResult.user}@{testResult.warehouse} • {testResult.database}
                  </p>
                ) : (
                  <p className="text-red-600 text-sm mt-1">{testResult.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={testing || !formData.account || !formData.user || !formData.password}
              className="flex-1 px-4 py-2.5 bg-[#3366FF] text-white rounded-lg hover:bg-blue-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {testing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Testing...
                </>
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </form>

        {/* Footer Note */}
        <div className="px-6 pb-5">
          <p className="text-xs text-gray-400 text-center">
            Your credentials are sent directly to the backend server running on localhost:8000
          </p>
        </div>
      </div>
    </div>
  );
}

