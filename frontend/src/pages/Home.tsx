import "../App.css";
import Header from "../components/Header";
import Shorten from "../components/Shorten";

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-50 p-4 sm:p-8 animate-gradient-x">
      <div className="max-w-3xl mx-auto text-center">
        <Header />
        <Shorten />
      </div>
    </div>
  );
};

export default Home;
