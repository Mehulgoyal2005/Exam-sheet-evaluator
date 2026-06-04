import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { PlusCircle, Clock, LogOut, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-64 min-h-screen bg-slate-900 flex flex-col fixed left-0 top-0 z-40">

      {/* ── App Name Section ── */}
      <div className="px-6 py-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="text-indigo-400" size={22} />
          <h1 className="text-white font-bold text-xl">EvalAI</h1>
        </div>
        <p className="text-slate-400 text-xs pl-1">Answer Sheet Evaluator</p>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700 mx-4 mb-4" />

      {/* ── Navigation Links ── */}
      <nav className="flex-1 px-3 space-y-1">

        {/* Create Exam — home page */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <PlusCircle size={18} />
          Create Exam
        </NavLink>

        {/* Previous Exams */}
        <NavLink
          to="/previous-exams"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <Clock size={18} />
          Previous Exams
        </NavLink>

      </nav>

      {/* ── Professor Info at Bottom ── */}
      <div className="border-t border-slate-700 mx-4 mb-4" />
      <div className="px-4 pb-6">
        <div className="mb-3">
          <p className="text-white text-sm font-medium truncate">
            {user?.name || 'Professor'}
          </p>
          <p className="text-slate-400 text-xs truncate mt-0.5">
            {user?.email || ''}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors w-full"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

    </div>
  );
};

export default Sidebar;