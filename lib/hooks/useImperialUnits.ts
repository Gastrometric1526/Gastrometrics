"use client"

import { useState, useEffect } from "react"

export function useImperialUnits(defaultValue = false) {
  const [useImperial, setUseImperial] = useState(defaultValue)

  useEffect(() => {
    // Optionally load from localStorage here
    // Example: localStorage.getItem('useImperial') === 'true'
    // setUseImperial(savedValue);
  }, [])

  const toggleUseImperial = () => {
    const newValue = !useImperial
    setUseImperial(newValue)
    // Optionally save to localStorage here
    // localStorage.setItem('useImperial', newValue.toString());
  }

  return { useImperial, toggleUseImperial }
}
