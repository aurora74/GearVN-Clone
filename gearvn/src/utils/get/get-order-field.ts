import { Clock, Truck, Package, XCircle, CheckCircle } from "lucide-react";

export const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case "processing":
      return Clock;
    case "shipping":
      return Truck;
    case "completed":
      return CheckCircle;
    case "cancelled":
      return XCircle;
    default:
      return Package;
  }
};

export const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "processing":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "shipping":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "completed":
      return "bg-green-100 text-green-800 border-green-200";
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export const getPaymentStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "paid":
      return "bg-green-100 text-green-800 border-green-200";
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};
