import React, { useState, useEffect } from "react";
import axios from "axios";
import { MousePointer } from "lucide-react";

const API_BASE_URL = "http://localhost";
const POLLING_INTERVAL = 2000;

interface ViewClicksProps {
  urlId: string;
  initialClicks?: number;
}

const ViewClicks: React.FC<ViewClicksProps> = ({
  urlId,
  initialClicks = 0,
}) => {
  const [clicks, setClicks] = useState<number | null>(initialClicks);
  const [loading, setLoading] = useState(!initialClicks);
  const [error, setError] = useState<string | null>(null);

  const fetchClicks = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/view/${urlId}`);
      setClicks(response.data.count);
      setError(null);
    } catch (err) {
      setError("Failed to fetch click count");
      console.error("Error fetching clicks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClicks();
    const intervalId = setInterval(fetchClicks, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [urlId]);

  if (loading) {
    return (
      <button
        type="button"
        className="flex items-center gap-1 p-1 sm:p-2 hover:bg-white/50 rounded-full transition-colors"
        aria-label="View Clicks"
      >
        <MousePointer className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
        <span className="text-xs sm:text-sm font-medium text-gray-600">
          0 clicks
        </span>
      </button>
    );
  }

  if (error || clicks === null) {
    return null;
  }

  return (
    <button
      type="button"
      className="flex items-center gap-1 p-1 sm:p-2 hover:bg-white/50 rounded-full transition-colors"
      aria-label="View Clicks"
    >
      <MousePointer className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
      <span className="text-xs sm:text-sm font-medium text-gray-600">
        {clicks} clicks
      </span>
    </button>
  );
};

export default ViewClicks;
