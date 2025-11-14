'use client';

// Login/Signup page - handles user authentication
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Schema uses 'name' not 'username'
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Get backend URL from environment variables (must be NEXT_PUBLIC_ for client-side)
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Determine endpoint based on signup or login
      const endpoint = isSignup ? '/auth/signup' : '/auth/login';
      const body = isSignup 
        ? { email, password, name } // Use 'name' to match schema
        : { email, password };

      // Send request to backend
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        // Store JWT token in localStorage
        localStorage.setItem('token', data.token);
        // Store user info for easier access
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        // Show error message
        setError(data.error || 'An error occurred');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-xl">
        <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
          {isSignup ? 'Create Account' : 'Welcome Back'}
        </h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Password input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Name input - only shown during signup */}
          {isSignup && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-md transition-colors duration-200"
          >
            {loading ? 'Please wait...' : (isSignup ? 'Sign Up' : 'Login')}
          </button>
        </form>

        {/* Toggle between signup and login */}
        <p className="mt-6 text-center text-gray-600">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setError('');
            }}
            className="text-blue-600 hover:text-blue-800 font-semibold"
          >
            {isSignup ? 'Login' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}
