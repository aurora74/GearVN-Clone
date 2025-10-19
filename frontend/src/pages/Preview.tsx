import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Box, CircularProgress, Typography, Container } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

const Preview: React.FC = () => {
  const { id } = useParams();
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(10);

  useEffect(() => {
    if (id) {
      const fetchOriginalUrl = async () => {
        try {
          const response = await axios.get(`http://localhost/short/${id}`);
          setOriginalUrl(response.data.origin);
        } catch (err) {
          setError("Error fetching the original URL.");
        }
      };
      fetchOriginalUrl();
    }
  }, [id]);

  useEffect(() => {
    if (originalUrl) {
      const countdown = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);

      if (timer === 0) {
        window.location.href = originalUrl;
      }

      return () => clearInterval(countdown);
    }
  }, [originalUrl, timer]);

  const handleLinkClick = () => {
    window.location.href = originalUrl!;
  };

  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          justifyContent: "center",
          alignItems: "center",
          padding: { xs: 2, sm: 4 },
        }}
      >
        <div className="w-full max-w-2xl bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 sm:p-8">
          {error ? (
            <Box sx={{ textAlign: "center" }}>
              <ErrorOutlineIcon
                sx={{ fontSize: 60, color: "#DC2626", mb: 2 }}
              />
              <Typography variant="h5" sx={{ color: "#DC2626" }} gutterBottom>
                {error}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ textAlign: "center" }}>
              <CircularProgress
                variant="determinate"
                value={(timer / 10) * 100}
                size={80}
                thickness={4}
                sx={{
                  mb: 4,
                  color: "#6366f1",
                  "& .MuiCircularProgress-circle": {
                    strokeLinecap: "round",
                  },
                }}
              />
              <Typography
                variant="h4"
                className="mb-6 text-gray-800 font-semibold"
                sx={{
                  fontSize: { xs: "1.5rem", sm: "2rem" },
                }}
              >
                Redirecting you to:
              </Typography>
              <div className="flex items-center justify-center gap-2 mb-6">
                <a
                  href={originalUrl!}
                  onClick={handleLinkClick}
                  className="text-indigo-600 hover:text-indigo-800 transition-colors duration-200 hover:underline text-sm sm:text-base break-all"
                >
                  {originalUrl}
                </a>
              </div>
              <Typography
                variant="body1"
                className="text-gray-600"
                sx={{
                  fontSize: { xs: "0.875rem", sm: "1rem" },
                }}
              >
                Redirect automatically in {timer} seconds ...
              </Typography>
            </Box>
          )}
        </div>
      </Box>
    </Container>
  );
};

export default Preview;
