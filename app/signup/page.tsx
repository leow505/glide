"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import mailcheck from "mailcheck";
import { states } from 'states-us';
import { parsePhoneNumberFromString } from "libphonenumber-js";

const STATE_CODES = states.map(s => s.abbreviation) as [string, ...string[]];
type UsState = (typeof STATE_CODES)[number];

type SignupFormData = {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;
  ssn: string;
  address: string;
  city: string;
  state: UsState;
  zipCode: string;
};

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState("+1");

  const checkEmailTypo = (email: string) => {
    mailcheck.run({
      email: email,
      suggested: (suggestion: any) => {
        setEmailSuggestion(suggestion.full);
      },
      empty: () => {
        setEmailSuggestion(null);
      }
    })
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
    setValue,
  } = useForm<SignupFormData>();
  const signupMutation = trpc.auth.signup.useMutation();

  const password = watch("password");

  const nextStep = async () => {
    let fieldsToValidate: (keyof SignupFormData)[] = [];

    if (step === 1) {
      fieldsToValidate = ["email", "password", "confirmPassword"];
    } else if (step === 2) {
      fieldsToValidate = ["firstName", "lastName", "phoneNumber", "dateOfBirth"];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setStep(step + 1);
    }
  };

  const prevStep = () => setStep(step - 1);

  const onSubmit = async (data: SignupFormData) => {
    try {
      setError("");
      await signupMutation.mutateAsync(data);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Create your account</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Step {step} of 3</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                      message: "Invalid email address",
                    },
                  })}
                  type="email"
                  onBlur={(e) => checkEmailTypo(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                />
                {emailSuggestion && (
                  <p className="mt-1 text-sm text-gray-600">
                    Did you mean{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setValue("email", emailSuggestion);
                        setEmailSuggestion(null);
                      }}
                      className="text-blue-600 hover:text-blue-800 font-semibold underline"
                    >
                      {emailSuggestion}
                    </button>
                    ?
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Emails are case-insensitive and will be saved in lowercase.
                </p>
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  {...register("password", {
                    required: "Password is required",
                    validate: (value) => {
                      if (value.length < 8) {
                        return "Password must be at least 8 characters";
                      }
                      if (!value.match(/\d/)) {
                        return "Password must contain a number";
                      }
                      if (!value.match(/[a-z]/)) {
                        return "Password must contain a lowercase letter";
                      }
                      if (!value.match(/[A-Z]/)) {
                        return "Password must contain an uppercase letter";
                      }
                      if (!value.match(/[.!@#$%^&*]/)) {
                        return "Password must contain a special character";
                      }
                      return true;
                    },
                  })}
                  type="password"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                />
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  {...register("confirmPassword", {
                    required: "Please confirm your password",
                    validate: (value) => value === password || "Passwords do not match",
                  })}
                  type="password"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    {...register("firstName", { required: "First name is required" })}
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  />
                  {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>}
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    {...register("lastName", { required: "Last name is required" })}
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  />
                  {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                >
                  <option value="+1">United States (+1)</option>
                  <option value="+91">India (+91)</option>
                  {/* Add more codes as needed */}
                </select>
                <input
                  {...register("phoneNumber", {
                    required: "Phone number is required",
                    validate: (value) => {
                      const fullNumber = countryCode + value;
                      const phoneNumber = parsePhoneNumberFromString(fullNumber);
                      return phoneNumber?.isValid() || "Invalid phone number";
                    }
                  })}
                  type="tel"
                  placeholder="1234567890"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                />
                {errors.phoneNumber && <p className="mt-1 text-sm text-red-600">{errors.phoneNumber.message}</p>}
              </div>

              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
                  Date of Birth
                </label>
                <input
                  {...register("dateOfBirth", {
                    required: "Date of birth is required", validate: (value) => {
                      const date = new Date(value);
                      const today = new Date();
                      if (date > today) return "Birth date cannot be in the future";
                      const age = today.getFullYear() - date.getFullYear();
                      return age >= 18 ? true : "You must be at least 18 years old";
                    }
                  })}
                  type="date"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                />
                {errors.dateOfBirth && <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="ssn" className="block text-sm font-medium text-gray-700">
                  Social Security Number
                </label>
                <input
                  {...register("ssn", {
                    required: "SSN is required",
                    pattern: {
                      value: /^\d{9}$/,
                      message: "SSN must be 9 digits",
                    },
                  })}
                  type="text"
                  placeholder="123456789"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                />
                {errors.ssn && <p className="mt-1 text-sm text-red-600">{errors.ssn.message}</p>}
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Street Address
                </label>
                <input
                  {...register("address", { required: "Address is required" })}
                  type="text"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                />
                {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>}
              </div>

              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-3">
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    City
                  </label>
                  <input
                    {...register("city", { required: "City is required" })}
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  />
                  {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
                </div>

                <div className="col-span-1">
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                    State
                  </label>
                  <select
                    {...register("state", {
                      required: "State is required",
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  >
                    <option value="">Select State</option>
                    {states.map((state) => (
                      <option key={state.abbreviation} value={state.abbreviation}>
                        {state.abbreviation}
                      </option>
                    ))}
                  </select>
                  {errors.state && <p className="mt-1 text-sm text-red-600">{errors.state.message}</p>}
                </div>

                <div className="col-span-2">
                  <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700">
                    ZIP Code
                  </label>
                  <input
                    {...register("zipCode", {
                      required: "ZIP code is required",
                      pattern: {
                        value: /^\d{5}$/,
                        message: "ZIP code must be 5 digits",
                      },
                    })}
                    type="text"
                    placeholder="12345"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  />
                  {errors.zipCode && <p className="mt-1 text-sm text-red-600">{errors.zipCode.message}</p>}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex justify-between">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Previous
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="ml-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={signupMutation.isPending}
                className="ml-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {signupMutation.isPending ? "Creating account..." : "Create Account"}
              </button>
            )}
          </div>
        </form>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
