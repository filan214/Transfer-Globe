import { clubs, transfers } from "../lib/data";
import TransferGlobeApp from "./components/TransferGlobeApp";

export default function Home() {
  return <TransferGlobeApp clubs={clubs} transfers={transfers} />;
}
