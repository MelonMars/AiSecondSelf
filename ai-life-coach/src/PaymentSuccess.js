import React, { useState, useEffect } from 'react';
import { CheckCircle, Zap, ArrowRight, Home } from 'lucide-react';

const PaymentSuccess = () => {
  const [showContent, setShowContent] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState([]);

  useEffect(() => {
    const pieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 2,
      color: ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 5)]
    }));
    setConfettiPieces(pieces);

    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);
  const handleStartChatting = () => {
    window.location.href = '/ai-life-coach';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {confettiPieces.map((piece) => (
          <div
            key={piece.id}
            className="absolute w-3 h-3 opacity-80"
            style={{
              left: `${piece.left}%`,
              backgroundColor: piece.color,
              animation: `confetti-fall ${piece.duration}s ease-out ${piece.delay}s infinite`,
              borderRadius: Math.random() > 0.5 ? '50%' : '0'
            }}
          />
        ))}
      </div>

      <div className={`relative z-10 text-center max-w-2xl mx-auto transition-all duration-1000 transform ${
        showContent ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}>
        <div className="mb-8 relative">
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 shadow-2xl shadow-green-500/25 animate-bounce">
            <CheckCircle className="w-16 h-16 text-white" />
          </div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 opacity-20 animate-ping"></div>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 animate-pulse">
          You're All Set! 🎉
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-200 mb-8 leading-relaxed">
          Your payment was successful and your credits have been added to your account.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-semibold">
            Time to start chatting!
          </span>
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-10 text-left">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
            <Zap className="w-8 h-8 text-yellow-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Credits Added</h3>
            <p className="text-gray-300 text-sm">Your new credits are ready to use</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
            <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Instant Access</h3>
            <p className="text-gray-300 text-sm">Start using your credits immediately</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
            <Home className="w-8 h-8 text-blue-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Welcome Back</h3>
            <p className="text-gray-300 text-sm">Continue where you left off</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleStartChatting}
            className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold text-white shadow-lg hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-105 hover:from-purple-700 hover:to-pink-700"
          >
            <span className="flex items-center justify-center gap-2">
              Start Chatting
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>

        <p className="text-gray-400 mt-8 text-sm">
          Thank you for your purchase! If you have any questions, feel free to reach out to our support team.
        </p>
      </div>

      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default PaymentSuccess;