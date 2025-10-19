import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faChartColumn,
  faHeadset,
} from "@fortawesome/free-solid-svg-icons";
import "../App.css";
import { Box } from "@mui/material";

const Header = () => {
  function FeatureCard({ icon, title, description }) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <FontAwesomeIcon
          icon={icon}
          className="text-4xl text-indigo-700 mb-4"
        />
        <h3 className="text-xl font-bold text-indigo-700 mb-2">{title}</h3>
        <p>{description}</p>
      </div>
    );
  }

  return (
    <Box>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-indigo-700 mb-4">
          A short link, infinite possibilities
        </h2>
        <p className="text-xl mb-8">
          With the advanced intelligent link shortening service, you can
          customize your links and share them easily.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard
          icon={faPenToSquare}
          title="Custom Domains"
          description="Track audience individually for each brand, website, or client by using your own domain or subdomain for link shortening."
        />
        <FeatureCard
          icon={faChartColumn}
          title="Track Clicks"
          description="Focus your or your client's efforts on the most promising campaigns by taking actions based on comprehensive statistics."
        />
        <FeatureCard
          icon={faHeadset}
          title="Friendly Support"
          description="We really care about your success in using short links, so you always get answers."
        />
      </div>
    </Box>
  );
};

export default Header;
