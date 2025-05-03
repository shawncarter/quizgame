import React, { useState, useEffect } from 'react';
import './MultipleChoiceAnswers.css';

/**
 * Multiple choice answer selection component
 * @param {Object} props - Component props
 * @param {Array} props.options - Array of answer options
 * @param {function} props.onSelect - Callback function when an option is selected
 * @param {boolean} props.disabled - Whether the selection is disabled
 * @param {number} props.selectedIndex - Index of the currently selected option
 * @param {number} props.correctIndex - Index of the correct answer (for feedback)
 * @param {boolean} props.showCorrect - Whether to show the correct answer
 * @param {number} props.timeLimit - Time limit in seconds (optional)
 */
const MultipleChoiceAnswers = ({ 
  options = [], 
  onSelect, 
  disabled = false, 
  selectedIndex = -1,
  correctIndex = -1,
  showCorrect = false,
  timeLimit = 0
}) => {
  const [selected, setSelected] = useState(selectedIndex);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Handle time limit countdown
  useEffect(() => {
    let timer;
    if (timeLimit > 0 && timeRemaining > 0 && !disabled && !isSubmitted) {
      timer = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (timeLimit > 0 && timeRemaining === 0 && !isSubmitted) {
      // Auto-submit when time runs out
      handleSubmit();
    }
    
    return () => clearTimeout(timer);
  }, [timeRemaining, disabled, isSubmitted, timeLimit]);

  // Reset component when options change
  useEffect(() => {
    setSelected(selectedIndex);
    setTimeRemaining(timeLimit);
    setIsSubmitted(false);
  }, [options, selectedIndex, timeLimit]);

  // Handle option selection
  const handleSelect = (index) => {
    if (disabled || isSubmitted) return;
    setSelected(index);
  };

  // Handle answer submission
  const handleSubmit = () => {
    if (disabled || selected === -1 || isSubmitted) return;
    
    setIsSubmitted(true);
    
    if (onSelect && typeof onSelect === 'function') {
      onSelect(selected);
    }
  };

  // Get option class based on state
  const getOptionClass = (index) => {
    const classes = ['answer-option'];
    
    if (index === selected) {
      classes.push('selected');
    }
    
    if (isSubmitted || showCorrect) {
      if (index === correctIndex) {
        classes.push('correct');
      } else if (index === selected && index !== correctIndex) {
        classes.push('incorrect');
      }
    }
    
    return classes.join(' ');
  };

  return (
    <div className="multiple-choice-container">
      {timeLimit > 0 && (
        <div className="timer-bar">
          <div 
            className="timer-progress" 
            style={{ 
              width: `${(timeRemaining / timeLimit) * 100}%`,
              backgroundColor: timeRemaining < 5 ? '#ff3a3a' : '#4caf50'
            }}
          />
          <span className="timer-text">{timeRemaining}s</span>
        </div>
      )}
      
      <div className="answer-options">
        {options.map((option, index) => (
          <button
            key={index}
            className={getOptionClass(index)}
            onClick={() => handleSelect(index)}
            disabled={disabled || isSubmitted}
          >
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span className="option-text">{option}</span>
          </button>
        ))}
      </div>
      
      <button 
        className="submit-button"
        onClick={handleSubmit}
        disabled={disabled || selected === -1 || isSubmitted}
      >
        Submit Answer
      </button>
    </div>
  );
};

export default MultipleChoiceAnswers;
