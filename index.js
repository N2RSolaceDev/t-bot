<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>The Esports Scene</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background-color: #0d0d0d;
      color: #00ff00;
      font-family: 'Courier New', Courier, monospace;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      scroll-behavior: smooth;
    }

    .container {
      max-width: 600px;
      padding: 40px 20px;
      margin: 50px auto;
    }

    h1 {
      font-size: 3rem;
      margin-bottom: 20px;
      color: #0f0;
      text-shadow: 0 0 5px #0f0, 0 0 10px #0f0;
    }

    p {
      font-size: 1.1rem;
      margin-bottom: 30px;
      color: #ccc;
      line-height: 1.6;
    }

    .purpose {
      max-width: 600px;
      margin: 30px auto;
      padding: 20px;
      background-color: #1a1a1a;
      border-left: 3px solid #0f0;
      font-size: 0.95rem;
      color: #ddd;
      line-height: 1.6;
      text-align: left;
    }

    .exposed-section {
      margin-top: 60px;
    }

    .exposed-card {
      background-color: #111;
      border: 1px solid #0f0;
      padding: 20px;
      border-radius: 6px;
      margin: 20px auto;
      max-width: 500px;
      text-align: left;
      animation: glow 2s infinite alternate;
    }

    @keyframes glow {
      from { box-shadow: 0 0 5px #0f0; }
      to { box-shadow: 0 0 15px #0f0; }
    }

    .exposed-card h2 {
      color: #0f0;
      font-size: 1.3rem;
      margin-bottom: 10px;
    }

    .exposed-card p {
      color: #ccc;
      font-size: 0.95rem;
      margin-bottom: 10px;
    }

    .footer {
      font-size: 0.9rem;
      color: #555;
      margin-top: 60px;
    }

    a {
      color: #0f0;
      text-decoration: none;
    }

    .scroll-hint {
      text-align: center;
      font-size: 1rem;
      color: #aaa;
      margin-top: 60px;
      animation: bounce 2s infinite;
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(10px); }
    }
  </style>
</head>
<body>

  <div class="container">
    <h1>The Esports Scene</h1>
    <p>Coming soon — A safe space to expose doxxers, p3dos, trolls, and unethical teams in esports.</p>

    <div class="purpose">
      <strong>Purpose:</strong><br>
      We're building a platform where players and fans can report toxic behavior — no personal info shared.<br><br>
      Think someone deserves a spotlight for ruining communities? We’re listening.<br><br>
      No logs • No ads • No nonsense.
    </div>

    <!-- Exposed Individual Card -->
    <section class="exposed-section">
      <h2>Exposed by Solace</h2>

      <div class="exposed-card">
        <h2>Melt</h2>
        <p><strong>Known for:</strong> Fraud, Doxxing, Abuse, P3do Behavior</p>

        <p>
          Melt was an esports team owner involved in multiple unethical actions: faking his income, lying about having a job, and using doxxing as leverage to control underage members.
        </p>
        <p>
          He targeted teenagers with threats and harassment to keep them on teams or remove them at will. His behavior created toxic environments under the guise of competitive professionalism.
        </p>
        <p>
          <strong>Outcome:</strong> After being exposed by Solace, further investigation revealed unrelated but severe criminal charges. Melt is now in jail awaiting trial for <strong>armed robbery</strong> and <strong>battery</strong> against his ex-girlfriend.
        </p>
      </div>
    </section>

    <div class="scroll-hint">↓ Stay Tuned ↓</div>
  </div>

  <p class="footer">
    hosted at <a href="https://caught.wiki " target="_blank">caught.wiki</a>
  </p>

</body>
</html>
