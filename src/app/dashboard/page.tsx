"use client";

const DashboardPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-4xl font-bold text-gray-800">
          Welcome to your Dashboard!
        </h1>

        <p className="mt-3 text-xl text-gray-600">
          Your account is pending admin approval.
        </p>
      </main>

      <footer className="flex items-center justify-center w-full border-t">
      </footer>
    </div>
  );
};

export default DashboardPage;
