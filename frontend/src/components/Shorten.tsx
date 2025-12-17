import { useState, useEffect } from "react";
import { Box, Pagination } from "@mui/material";
import { Copy, Link as LinkIcon, QrCode, Send as SendIcon } from "lucide-react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import ViewClicks from "./ViewClicks";

interface ShortenedUrl {
  shortUrl: string;
  originalUrl: string;
  createdAt: string;
  expiry: number;
}

const EXPIRY_MINUTES = 10;
const ITEMS_PER_PAGE = 5;
const API_BASE_URL = "http://localhost";

const Shorten = () => {
  const [originalUrl, setOriginalUrl] = useState("");
  const [shortenedUrls, setShortenedUrls] = useState<ShortenedUrl[]>(() => {
    const saved = localStorage.getItem("shortenedUrls");
    if (!saved) return [];
    const urls = JSON.parse(saved);
    return urls.filter(
      (url: ShortenedUrl) => new Date().getTime() <= url.expiry
    );
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showQR, setShowQR] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [shortenSuccess, setShortenSuccess] = useState(false);

  useEffect(() => {
    const validUrls = shortenedUrls.filter(
      (url) => new Date().getTime() <= url.expiry
    );
    localStorage.setItem("shortenedUrls", JSON.stringify(validUrls));
  }, [shortenedUrls]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      const response = await axios.post(
        `${API_BASE_URL}/short`,
        { origin: originalUrl },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.status === 200) {
        const newShortUrl = `${API_BASE_URL}/short/${response.data.id}`;
        setShortenedUrls((prev) => [
          {
            shortUrl: newShortUrl,
            originalUrl: originalUrl,
            createdAt: new Date().toISOString(),
            expiry: new Date().getTime() + EXPIRY_MINUTES * 60 * 1000,
          },
          ...prev.filter((url) => new Date().getTime() <= url.expiry),
        ]);
        setOriginalUrl("");
        setCurrentPage(1);
        setShortenSuccess(true);
        setTimeout(() => {
          setShortenSuccess(false);
        }, 2000);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(`Failed to create short URL: ${error.message}`);
      } else {
        setErrorMessage(
          "Failed to create short URL: An unknown error occurred"
        );
      }
    }
  };

  const handleClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    const id = url.split("/").pop();
    window.open(`/short/${id}`, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async (urlToCopy: string) => {
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      setErrorMessage("Failed to copy to clipboard");
    }
  };

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
      return null;
    }
  };

  const renderQRCode = (url: string) => (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      onClick={() => setShowQR(null)}
    >
      <div
        className="bg-white p-4 sm:p-6 rounded-xl max-w-[90vw] sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <QRCodeSVG value={url} size={Math.min(256, window.innerWidth - 64)} />
      </div>
    </div>
  );
  const renderUrlCard = (url: ShortenedUrl, index: number) => (
    <div key={index} className="mt-6 relative animate-fade-in">
      <div className="absolute -top-3 right-0 bg-orange-500 text-white text-xs px-3 py-1 rounded-full">
        Expires in{" "}
        {Math.max(
          0,
          Math.floor((url.expiry - new Date().getTime()) / 1000 / 60)
        )}{" "}
        min
      </div>

      <div className="p-3 sm:p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
        <div className="flex flex-col sm:flex-row">
          <div className="flex items-center sm:flex-col sm:justify-center pr-4 mb-2 sm:mb-0">
            <img
              src={getFaviconUrl(url.originalUrl) || ""}
              className="rounded-full w-6 h-6"
              alt=""
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>

          <div className="flex-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <a
                href={url.shortUrl}
                onClick={(e) => handleClick(e, url.shortUrl)}
                className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors duration-200 hover:underline text-sm sm:text-base"
              >
                {`${API_BASE_URL}/short/${url.shortUrl.split("/").pop()}`}
              </a>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(url.shortUrl)}
                  className="p-1 sm:p-2 hover:bg-white/50 rounded-full transition-colors"
                  aria-label="Copy URL"
                >
                  <Copy className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowQR(url.shortUrl)}
                  className="p-1 sm:p-2 hover:bg-white/50 rounded-full transition-colors"
                  aria-label="Show QR Code"
                >
                  <QrCode className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
                </button>
                <ViewClicks urlId={url.shortUrl.split("/").pop() || ""} />
              </div>
            </div>
            <div className="mt-1 text-gray-600 text-left">
              <a
                href={url.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-indigo-600 transition-colors duration-200 hover:underline text-sm sm:text-base break-all line-clamp-1 sm:line-clamp-2"
              >
                {url.originalUrl}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Box>
      <form
        onSubmit={handleSubmit}
        className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4 sm:p-6 mb-8"
      >
        <div className="relative flex items-center w-full bg-gray-50/80 rounded-xl px-4 py-3">
          <LinkIcon className="text-indigo-500 w-5 h-5" />
          <input
            type="url"
            placeholder="Enter your URL"
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
            className="bg-transparent outline-none w-full text-gray-800 placeholder-gray-400 mx-2"
            required
          />
          <button
            type="submit"
            className="absolute right-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-7 py-2 rounded-full hover:scale-105 transition-all duration-300"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {shortenedUrls
            .slice(
              (currentPage - 1) * ITEMS_PER_PAGE,
              currentPage * ITEMS_PER_PAGE
            )
            .map((url, index) => renderUrlCard(url, index))}
        </div>

        {shortenedUrls.length > ITEMS_PER_PAGE && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Pagination
              count={Math.ceil(shortenedUrls.length / ITEMS_PER_PAGE)}
              page={currentPage}
              onChange={(event, value) => setCurrentPage(value)}
              shape="rounded"
              sx={{
                "& .MuiPaginationItem-root": {
                  color: "#6366f1",
                  "&.Mui-selected": {
                    backgroundColor: "#6366f1",
                    color: "white",
                    "&:hover": {
                      backgroundColor: "#4f46e5",
                    },
                  },
                  "&:hover": {
                    backgroundColor: "rgba(99, 102, 241, 0.1)",
                  },
                },
              }}
            />
          </Box>
        )}

        {errorMessage && (
          <p className="mt-4 text-red-600 animate-fade-in">{errorMessage}</p>
        )}
      </form>

      {copyFeedback && (
        <div className="fixed bottom-3 right-4 bg-gradient-to-r from-gray-800 to-gray-900 text-white px-6 py-3 rounded-xl shadow-lg animate-fade-in">
          Copied to clipboard!
        </div>
      )}

      {shortenSuccess && (
        <div className="fixed bottom-3 left-4 bg-gradient-to-r from-gray-800 to-gray-900 text-white px-6 py-3 rounded-xl shadow-lg animate-fade-in">
          Successfully shortened link!
        </div>
      )}

      {showQR && renderQRCode(showQR)}
    </Box>
  );
};

export default Shorten;
