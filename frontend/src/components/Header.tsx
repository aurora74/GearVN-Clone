import { Box } from "@mui/material";

const Header = () => {
  return (
    <Box>
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-transparent bg-clip-text animate-gradient">
        Short Links With{" "}
        <span className="block bg-gradient-to-r from-orange-500 to-pink-500 text-transparent bg-clip-text">
          Superpowers
        </span>
      </h1>
      <p className="text-lg sm:text-xl mb-8 sm:mb-12 bg-gradient-to-r from-gray-700 to-gray-500 text-transparent bg-clip-text">
        The open-source link management infrastructure for modern marketing
        teams
      </p>
    </Box>
  );
};

export default Header;
